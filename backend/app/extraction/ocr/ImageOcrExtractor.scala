package extraction.ocr

import java.io.{File, InputStream}
import java.nio.file.Files
import extraction.{ExtractionParams, Extractor, FileExtractor}
import model.manifest.{Blob, MimeType}
import services.index.Index
import services.{OcrConfig, ScratchSpace}
import utils.Ocr.OcrSubprocessInterruptedException
import utils.attempt.AttemptAwait._
import utils.attempt.{Failure, SubprocessInterruptedFailure}
import utils.{Logging, Ocr}

import scala.collection.mutable
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.util.control.NonFatal

// I've avoided renaming this for compatibility reasons (the extractor name is stored in the Manifest).
// It should now be called TesseractImageOcrExtractor
class ImageOcrExtractor(config: OcrConfig, scratch: ScratchSpace, index: Index)(implicit ec: ExecutionContext) extends FileExtractor(scratch) with Logging {
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

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    if (params.languages.isEmpty) {
      throw new IllegalStateException("Image OCR Extractor requires a language")
    }

    val stderr = mutable.Buffer.empty[String]

    try {
      params.languages.foreach { lang =>
        val text = Ocr.invokeTesseractDirectly(lang.ocr, file.getAbsolutePath, config.tesseract, stderr)
        val optionalText = if (text.trim().isEmpty) None else Some(text)
        index.addDocumentOcr(blob.uri, optionalText, lang).awaitEither(10.second)
      }

      Right(())
    } catch {
      case OcrSubprocessInterruptedException =>
        Left(SubprocessInterruptedFailure)

      case NonFatal(e) =>
        throw e
    } finally {
      if(stderr.nonEmpty) {
        logger.info(s"OCR output for ${blob.uri}")
        logger.info(stderr.mkString("\n"))
      }
    }
  }
}

