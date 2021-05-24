package extraction.ocr

import java.io.{File, InputStream}
import java.nio.file.{Files, Path}
import extraction.{ExtractionParams, Extractor, FileExtractor}
import model.index.{Page, PageDimensions}
import model.manifest.{Blob, MimeType}
import model.{Language, Uri}
import org.apache.commons.io.FileUtils
import org.apache.pdfbox.pdmodel.{PDDocument, PDPage}
import org.apache.pdfbox.text.PDFTextStripper
import services._
import services.index.{Index, Pages}
import services.previewing.PreviewService
import utils.attempt.AttemptAwait._
import utils.attempt.Failure
import utils.{Logging, Ocr}

import scala.collection.mutable
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.util.control.NonFatal

class OcrMyPdfExtractor(scratch: ScratchSpace, index: Index, pageService: Pages, previewStorage: ObjectStorage)(implicit ec: ExecutionContext) extends FileExtractor(scratch) with Logging {
  val mimeTypes = Set(
    "application/pdf"
  )

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

    val tmpDir = scratch.createWorkingDir(s"ocrmypdf-tmp-${blob.uri.value}")

    val stderr = mutable.Buffer.empty[String]
    var pdDocuments: Map[Language, (Path, PDDocument)] = Map.empty

    try {
      pdDocuments = params.languages.map { lang =>
        val pdfPath = Ocr.invokeOcrMyPdf(lang.ocr, file.toPath, None, stderr, tmpDir)
        val pdfDoc = PDDocument.load(pdfPath.toFile)

        lang -> (pdfPath, pdfDoc)
      }.toMap

      // All docs have the same number of pages with the same dimensions, just different text from the OCR run per language
      val (_, (_, firstDoc)) = pdDocuments.head
      val numberOfPages = firstDoc.getNumberOfPages

      val base = (List.empty[Page], 0.0)

      val (pages, _) = (1 to numberOfPages).foldLeft(base) { case ((pages, offsetHeight), pageNumber) =>
        val page = firstDoc.getPage(pageNumber - 1)
        val pageBoundingBox = page.getMediaBox

        val dimensions = PageDimensions(
          width = pageBoundingBox.getWidth,
          height = pageBoundingBox.getHeight,
          top = offsetHeight,
          bottom = offsetHeight + pageBoundingBox.getHeight
        )

        val textByLanguage = pdDocuments.map { case (lang, (_, doc)) =>
          assert(doc.getNumberOfPages == numberOfPages, s"Number of pages mismatch across languages: ${pdDocuments.mapValues(_._2.getNumberOfPages)}")

          val reader = new PDFTextStripper()
          reader.setStartPage(pageNumber)
          reader.setEndPage(pageNumber)

          val text = reader.getText(doc)
          lang -> text
        }

        (pages :+ Page(pageNumber, textByLanguage, dimensions), dimensions.bottom)
      }

      // Write to the page index in Elasticsearch - a document in the index corresponds to a single page
      pageService.addPageContents(blob.uri, pages)

      // Upload each page to S3, per language. This is because OCRing English produces totally different output to OCRing
      // Russian for example so we store each page and decide later which one to serve the viewer
      pdDocuments.foreach { case (lang, (path, doc)) =>
        (1 to numberOfPages).foreach { pageNumber =>
          val page = doc.getPage(pageNumber - 1)
          uploadPageAsSeparatePdf(blob, lang, pageNumber, page, previewStorage)
        }

        // Upload the entire document to S3, per language. We serve these to the client as a download of the whole doc
        // TODO MRB: stop overwriting when we are OCRing against multiple languages?
        previewStorage.create(blob.uri.toStoragePath, path, Some("application/pdf"))
      }

      OcrMyPdfExtractor.insertFullText(blob.uri, pages, index)

      Right(())
    } catch {
      case NonFatal(e) =>
        throw new IllegalStateException(s"PdfOcrExtractor error ${stderr.mkString("\n")}", e)
    } finally {
      pdDocuments.foreach { case(_, (path, doc)) =>
        doc.close()
        Files.deleteIfExists(path)
      }

      FileUtils.deleteDirectory(tmpDir.toFile)

      if(stderr.nonEmpty) {
        logger.info(s"OCR output for ${blob.uri}")
        logger.info(stderr.mkString("\n"))
      }
    }
  }

  private def uploadPageAsSeparatePdf(blob: Blob, language: Language, pageNumber: Int, page: PDPage, previewStorage: ObjectStorage): Unit = {
    val doc = new PDDocument()
    val tempFile = Files.createTempFile(s"${language.key}-${blob.uri}-${pageNumber}", ".pdf")

    try {
      doc.importPage(page)
      doc.save(tempFile.toFile)

      val key = PreviewService.getPageStoragePath(blob.uri, language, pageNumber)
      previewStorage.create(key, tempFile, Some("application/pdf"))
    } finally {
      doc.close()
      Files.deleteIfExists(tempFile)
    }
  }
}

object OcrMyPdfExtractor {
  def insertFullText(uri: Uri, pages: List[Page], index: Index)(implicit ec: ExecutionContext): Unit = {
    val textByLanguage = pages.foldLeft(Map.empty[Language, String]) { (acc, page) =>
      page.value.foldLeft(acc) { case (acc, (lang, value)) =>
        acc + (lang -> (acc.getOrElse(lang, "") + value))
      }
    }

    textByLanguage.foreach { case (lang, value) =>
      val optionalText = if (value.trim().isEmpty) None else Some(value)
      index.addDocumentOcr(uri, optionalText, lang).awaitEither(10.second)
    }
  }
}
