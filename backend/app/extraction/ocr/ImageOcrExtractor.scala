package extraction.ocr

import extraction.ExtractionParams
import model.manifest.{Blob, MimeType}
import services.index.Index
import services.ingestion.IngestionServices
import services.{OcrConfig, ScratchSpace}
import utils.attempt.AttemptAwait._
import utils.{Logging, Ocr, OcrStderrLogger}

import java.io.File
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._

// I've avoided renaming this for compatibility reasons (the extractor name is stored in the Manifest).
// It should now be called TesseractImageOcrExtractor
class ImageOcrExtractor(config: OcrConfig, scratch: ScratchSpace, index: Index, ingestionServices: IngestionServices)
  (implicit ec: ExecutionContext) extends BaseOcrExtractor(scratch) with Logging {

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
    params.languages.foreach { lang =>
      val text = Ocr.invokeTesseractDirectly(lang.ocr, file.getAbsolutePath, config.tesseract, stdErrLogger)
      val optionalText = if (text.trim().isEmpty) None else Some(text)
      index.addDocumentOcr(blob.uri, optionalText, lang).awaitEither(10.second)
    }
  }
}

