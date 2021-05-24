package extraction.ocr

import java.io.{File, InputStream}
import java.nio.file.{Files, Paths}
import extraction.{ExtractionParams, Extractor, FileExtractor}
import model.index.{Page, PageDimensions}
import model.manifest.{Blob, MimeType}
import model.{Language, Uri}
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.rendering.{ImageType, PDFRenderer}
import org.apache.pdfbox.tools.imageio.ImageIOUtil
import services.index.{Index, Pages}
import services.ingestion.IngestionServices
import services.{OcrConfig, ScratchSpace}
import utils.Ocr.OcrSubprocessInterruptedException
import utils.attempt.AttemptAwait._
import utils.attempt.{Failure, SubprocessInterruptedFailure}
import utils.{Logging, Ocr, OcrStderrLogger}

import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.util.control.NonFatal

// We could also use this as a possible fallback option after the primary OcrMyPdfExtractor, which
// doesn't ocr as many docs (e.g. it respects encryption of PDFs)
class TesseractPdfOcrExtractor(config: OcrConfig, scratch: ScratchSpace, index: Index, pageService: Pages, ingestionServices: IngestionServices)(implicit ec: ExecutionContext) extends FileExtractor(scratch) with Logging {
  val mimeTypes = Set(
    "application/pdf"
  )

  // This maintains compatibility with the old name which is stored in the manifest
  // TODO: add a unit test so that a new extractor can't use this name
  override def name = "PdfOcrExtractor"

  override def canProcessMimeType = mimeTypes.contains

  override def indexing = true
  override def priority = 2

  override def cost(mimeType: MimeType, size: Long): Long = {
    100 * size
  }

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    if (params.languages.isEmpty) {
      throw new IllegalStateException("Image OCR Extractor requires a language")
    }

    val stderr = new OcrStderrLogger(None) // this extractor manually sets the progress note
    var document: PDDocument = null

    try {
      document = PDDocument.load(file)
      val renderer = new PDFRenderer(document)

      val totalPages = document.getNumberOfPages

      val (pages, _) = (0 until totalPages).foldLeft((List.empty[Page], 0f)) { case ((pages, offsetHeight), pageNumber) =>
        val pageBoundingBox = document.getPage(pageNumber).getMediaBox

        // TODO MRB: does RGB colour help or hinder here?
        val imageFileName = s"${file.getAbsolutePath}-$pageNumber.png"
        val image = renderer.renderImageWithDPI(pageNumber, config.dpi, ImageType.RGB)
        ImageIOUtil.writeImage(image, imageFileName, config.dpi)

        val dimensions = PageDimensions(
          width = pageBoundingBox.getWidth,
          height = pageBoundingBox.getHeight,
          top = offsetHeight,
          bottom = offsetHeight + pageBoundingBox.getHeight
        )

        val pageTextByLanguage = params.languages.map { lang =>
          ingestionServices.setProgressNote(blob.uri, this, s"Page ${pageNumber + 1}/${totalPages} (${lang.key})")
          val text = Ocr.invokeTesseractDirectly(lang.ocr, imageFileName, config.tesseract, stderr)

          lang -> text
        }

        val page = Page(pageNumber, pageTextByLanguage.toMap, dimensions)

        Files.delete(Paths.get(imageFileName))

        (pages :+ page, (offsetHeight + pageBoundingBox.getHeight))
      }

      pageService.addPageContents(blob.uri, pages)
      OcrMyPdfExtractor.insertFullText(blob.uri, pages, index)

      Right(())
    } catch {
      case OcrSubprocessInterruptedException =>
        Left(SubprocessInterruptedFailure)

      case NonFatal(e) =>
        throw e
    } finally {
      Option(document).foreach(_.close())
      cleanup(file)
    }
  }

  private def cleanup(pdfFile: File): Unit = {
    pdfFile.getParentFile.listFiles().foreach { file =>
      if(file.getAbsolutePath.startsWith(pdfFile.getAbsolutePath)) {
        Files.delete(file.toPath)
      }
    }
  }
}
