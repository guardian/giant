package extraction.ocr

import extraction.ExtractionParams
import model.manifest.{Blob, MimeType}
import model.{Language, Uri}
import org.apache.commons.io.FileUtils
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.text.PDFTextStripper
import services._
import services.index.Index
import services.ingestion.IngestionServices
import utils.attempt.AttemptAwait._
import utils.{Logging, Ocr, OcrStderrLogger}

import java.io.File
import java.nio.file.{Files, Path}
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._

class OcrMyPdfImageExtractor(config: OcrConfig, scratch: ScratchSpace, index: Index, previewStorage: ObjectStorage,
  ingestionServices: IngestionServices)(implicit ec: ExecutionContext) extends BaseOcrExtractor(scratch) with Logging {
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
      params.languages.foreach { lang =>
        val text = invokeOcrMyPdf(blob.uri, lang, file, config, stdErrLogger, tmpDir)
        val optionalText = if (text.trim().isEmpty) None else Some(text)
        index.addDocumentOcr(blob.uri, optionalText, lang).awaitEither(10.second)
      }
    } finally {
      FileUtils.deleteDirectory(tmpDir.toFile)
    }
  }

  private def invokeOcrMyPdf(blobUri: Uri, lang: Language, file: File, config: OcrConfig, stderr: OcrStderrLogger, tmpDir: Path): String = {
    val pdfFile = Ocr.invokeOcrMyPdf(lang.ocr, file.toPath, Some(config.dpi), stderr, tmpDir)
    var document: PDDocument = null

    try {
      document = PDDocument.load(pdfFile.toFile)

      val reader = new PDFTextStripper()
      val text = reader.getText(document)

      // TODO MRB: what to do when we are OCRing against multiple languages?
      previewStorage.create(blobUri.toStoragePath, pdfFile, Some("application/pdf"))
      text
    } finally {
      Option(document).foreach(_.close())
      Files.deleteIfExists(pdfFile)
    }
  }
}

