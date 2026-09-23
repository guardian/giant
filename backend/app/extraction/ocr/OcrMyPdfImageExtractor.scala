package extraction.ocr

import extraction.ocr.BaseOcrExtractor.handleOcrTranslation
import extraction.ExtractionParams
import model.ingestion.RedoOcr
import model.manifest.{Blob, MimeType}
import model.Language
import org.apache.commons.io.FileUtils
import org.apache.pdfbox.Loader
import org.apache.pdfbox.text.PDFTextStripper
import services._
import services.index.Index
import services.ingestion.IngestionServices
import utils.attempt.AttemptAwait._
import utils.{Logging, Ocr, OcrStderrLogger}

import java.io.File
import java.nio.file.Path
import scala.collection.mutable
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.sys.process.{Process, ProcessLogger}
import scala.util.Using

class OcrMyPdfImageExtractor(config: OcrConfig, scratch: ScratchSpace, index: Index, previewStorage: ObjectStorage,
  ingestionServices: IngestionServices)(implicit ec: ExecutionContext) extends BaseOcrExtractor(scratch, index) with Logging {
  val mimeTypes = Set(
    "image/png",
    "image/jpeg",
    "image/tiff"
  )

  override def canProcessMimeType = mimeTypes.contains

  override def indexing = true
  override def priority = 1

  override def cost(mimeType: MimeType, size: Long): Long = {
    100 * size
  }

  override def buildStdErrLogger(blob: Blob): OcrStderrLogger = {
    new OcrStderrLogger(Some(ingestionServices.setProgressNote(blob.uri, this, _)))
  }

  override def extractOcr(blob: Blob, file: File, params: ExtractionParams, stdErrLogger: OcrStderrLogger): Unit = {
    val tmpDir = scratch.createWorkingDir(s"ocrmypdf-tmp-${blob.uri.value}")

    try {
      val fileToOCR = OcrMyPdfImageExtractor.preProcessImage(blob, file, tmpDir, stdErrLogger)
      val numPages = Using(Loader.loadPDF(fileToOCR))(_.getNumberOfPages).toOption

      val ocrOutput = params.languages.map { lang =>
        val outputPdfPath = Ocr.invokeOcrMyPdf(lang.ocr, fileToOCR.toPath, Some(config.dpi), stdErrLogger, tmpDir, numPages, RedoOcr)
        lang -> outputPdfPath
      }

      OcrMyPdfImageExtractor.postProcessPdf(ocrOutput, blob, previewStorage, params, index, ingestionServices)
    } finally {
      FileUtils.deleteDirectory(tmpDir.toFile)
    }
  }
}

object OcrMyPdfImageExtractor extends Logging {
  private val imageTypesWithAlpha = Set("image/png", "image/tiff")

  private def preProcessImage(blob: Blob, file: File, tmpDir: Path, stdErrLogger: OcrStderrLogger): File = {
    val shouldRemoveAlpha = blob.mimeType.forall(m => imageTypesWithAlpha.contains(m.mimeType))
    if (shouldRemoveAlpha) removeAlphaChannel(file, tmpDir, stdErrLogger).getOrElse(file) else file
  }

  private def removeAlphaChannel(inputFile: File, tmpDir: Path, stderr: OcrStderrLogger): Option[File] = {
    val tempFile = tmpDir.resolve(s"${inputFile.toPath.getFileName}.alphaRemoved.png")
    val stdout = mutable.Buffer.empty[String]

    val cmd = s"convert ${inputFile.toPath.toAbsolutePath} -alpha off ${tempFile.toAbsolutePath}"
    val process = Process(cmd)
    val exitCode = process.!(ProcessLogger(stdout.append(_), stderr.append))
    stdout.foreach(logger.info)

    if (exitCode == 0) Some(tempFile.toFile) else {
      logger.error(s"Alpha removal failed, exit code ${exitCode}. Using original image.")
      None
    }
  }

  private def postProcessPdf(ocrOutput: List[(Language, Path)], blob: Blob, previewStorage: ObjectStorage,
    params: ExtractionParams, index: Index, ingestionServices: IngestionServices)(implicit ec: ExecutionContext): Unit = {
    val textByLanguage = ocrOutput.map { case (lang, pdfFile) =>
      val text = Using.resource(Loader.loadPDF(pdfFile.toFile)) { document =>
        val reader = new PDFTextStripper()
        val text = reader.getText(document)

        // TODO MRB: what to do when we are OCRing against multiple languages?
        previewStorage.create(blob.uri.toStoragePath, pdfFile, Some("application/pdf"))
        text
      }

      val optionalText = if (text.trim().isEmpty) None else Some(text)
      index.addDocumentOcr(blob.uri, optionalText, lang).awaitEither(10.second)
      lang -> text
    }.toMap

    handleOcrTranslation(blob.uri, textByLanguage, index, ingestionServices, params)
  }
}
