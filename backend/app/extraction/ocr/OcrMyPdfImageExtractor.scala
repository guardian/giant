package extraction.ocr

import java.io.{File, InputStream}
import java.nio.file.{Files, Path}
import extraction.{ExtractionParams, Extractor, FileExtractor}
import model.manifest.{Blob, MimeType}
import model.{Language, Uri}
import org.apache.commons.io.FileUtils
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.text.PDFTextStripper
import services.index.Index
import services._
import utils.attempt.AttemptAwait._
import utils.attempt.Failure
import utils.{Logging, Ocr}

import scala.collection.mutable
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.util.control.NonFatal

class OcrMyPdfImageExtractor(config: OcrConfig, scratch: ScratchSpace, index: Index, previewStorage: ObjectStorage)(implicit ec: ExecutionContext) extends FileExtractor(scratch) with Logging {
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

    val tmpDir = scratch.createWorkingDir(s"ocrmypdf-tmp-${blob.uri.value}")
    val stderr = mutable.Buffer.empty[String]

    try {
      params.languages.foreach { lang =>
        val text = invokeOcrMyPdf(blob.uri, lang, file, config, stderr, tmpDir)
        val optionalText = if (text.trim().isEmpty) None else Some(text)
        index.addDocumentOcr(blob.uri, optionalText, lang).awaitEither(10.second)
      }

      Right(())
    } catch {
      case NonFatal(e) =>
        throw new IllegalStateException(s"ImageOcrExtractor error ${stderr.mkString("\n")}", e)
    } finally {
      FileUtils.deleteDirectory(tmpDir.toFile)

      if(stderr.nonEmpty) {
        logger.info(s"OCR output for ${blob.uri}")
        logger.info(stderr.mkString("\n"))
      }
    }
  }

  private def invokeOcrMyPdf(blobUri: Uri, lang: Language, file: File, config: OcrConfig, stderr: mutable.Buffer[String], tmpDir: Path): String = {
    val pdfFile = Ocr.invokeOcrMyPdf(lang.ocr, file.getAbsolutePath, Some(config.dpi), stderr, tmpDir)
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

