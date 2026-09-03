package extraction.ocr

import extraction.ocr.BaseOcrExtractor.handleOcrTranslation
import extraction.ExtractionParams
import model.manifest.{Blob, MimeType}
import org.apache.commons.io.FileUtils
import services.index.Index
import services.ingestion.IngestionServices
import services.{OcrConfig, ScratchSpace}
import utils.attempt.AttemptAwait._
import utils.{Logging, Ocr, OcrStderrLogger}

import java.io.File
import scala.collection.mutable
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.sys.process.{Process, ProcessLogger}

// I've avoided renaming this for compatibility reasons (the extractor name is stored in the Manifest).
// It should now be called TesseractImageOcrExtractor
class ImageOcrExtractor(config: OcrConfig, scratch: ScratchSpace, index: Index, ingestionServices: IngestionServices)
  (implicit ec: ExecutionContext) extends BaseOcrExtractor(scratch, index) with Logging {

  val mimeTypes = Set(
    "image/avif",
    "image/bmp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/jpeg",
    "image/jp2",
    "image/png",
    "image/tiff",
    "image/webp"
  )

  // Tesseract does not read HEIF or AVIF, so convert these formats to PNG first.
  private val imageTypesRequiringConversion = Set("image/avif", "image/heic", "image/heif")

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
    val requiresConversion = blob.mimeType.exists(mimeType => imageTypesRequiringConversion.contains(mimeType.mimeType))
    val workingDirectory = Option.when(requiresConversion)(scratch.createWorkingDir(s"image-ocr-${blob.uri.value}"))

    try {
      val image = workingDirectory.map(directory => convertToPng(file, directory.toFile, stdErrLogger)).getOrElse(file)

      val textByLanguage = params.languages.map { lang =>
        val text = Ocr.invokeTesseractDirectly(lang.ocr, image.getAbsolutePath, config.tesseract, stdErrLogger)
        val optionalText = if (text.trim().isEmpty) None else Some(text)
        index.addDocumentOcr(blob.uri, optionalText, lang).awaitEither(10.second)
        lang -> text
      }.toMap

      handleOcrTranslation(blob.uri, textByLanguage, index, ingestionServices, params)
    } finally {
      workingDirectory.foreach(directory => FileUtils.deleteDirectory(directory.toFile))
    }
  }

  private def convertToPng(input: File, workingDirectory: File, stderr: OcrStderrLogger): File = {
    val output = new File(workingDirectory, "converted.png")
    val stdout = mutable.Buffer.empty[String]
    val exitCode = Process(Seq("convert", input.getAbsolutePath, output.getAbsolutePath))
      .!(ProcessLogger(stdout.append(_), stderr.append))
    stdout.foreach(logger.info)

    if (exitCode != 0) {
      throw new IllegalStateException(s"Image conversion failed with exit code $exitCode")
    }

    output
  }
}
