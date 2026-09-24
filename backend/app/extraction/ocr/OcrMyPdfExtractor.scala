package extraction.ocr

import extraction.ocr.BaseOcrExtractor.handleOcrTranslation
import extraction.ExtractionParams
import model.index.{Page, PageDimensions}
import model.ingestion.{RedoOcr, SkipText}
import model.manifest.{Blob, MimeType}
import model.{Language, Uri}
import org.apache.commons.io.FileUtils
import org.apache.pdfbox.Loader
import org.apache.pdfbox.pdmodel.{PDDocument, PDPage}
import org.apache.pdfbox.text.PDFTextStripper
import org.joda.time.DateTime
import services._
import services.index.{Index, Pages}
import services.ingestion.IngestionServices
import services.previewing.PreviewService
import utils.attempt.AttemptAwait._
import utils.{Logging, Ocr, OcrStderrLogger}

import java.io.File
import java.nio.file.{Files, Path}
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.util.{Failure, Success, Try, Using}

class OcrMyPdfExtractor(scratch: ScratchSpace, index: Index, pageService: Pages, previewStorage: ObjectStorage,
  ingestionServices: IngestionServices)(implicit ec: ExecutionContext) extends BaseOcrExtractor(scratch, index) with Logging {

  val mimeTypes = Set(
    "application/pdf"
  )

  override def canProcessMimeType = mimeTypes.contains

  override def indexing = true
  override def priority = 2

  override def cost(mimeType: MimeType, size: Long): Long = {
    100 * size
  }

  override def buildStdErrLogger(blob: Blob): OcrStderrLogger = {
    new OcrStderrLogger(Some(ingestionServices.setProgressNote(blob.uri, this, _)))
  }

  override def extractOcr(blob: Blob, file: File, params: ExtractionParams, stdErrLogger: OcrStderrLogger): Unit = {
    val tmpDir = scratch.createWorkingDir(s"ocrmypdf-tmp-${blob.uri.value}")

    val ocrMyPdfFlag = if (params.skipTextIngestionUris.contains(params.ingestion)) {
      logger.info(s"Using --skip-text instead of --redo-ocr for blob ${blob.uri}, ingestion ${params.ingestion}")
      SkipText
    } else RedoOcr

    try {
      // try to get the number of pages - useful for setting timeout on the ocr job
      val numPages = Using(Loader.loadPDF(file)) { doc => doc.getNumberOfPages }.toOption

      val preProcessedPdf = OcrMyPdfExtractor.preProcessPdf(blob, file, tmpDir, stdErrLogger)

      val pdDocuments = params.languages.map { lang =>
        val outputPdfPath = Ocr.invokeOcrMyPdf(lang.ocr, preProcessedPdf.getOrElse(file.toPath), None, stdErrLogger, tmpDir, numPages, ocrMyPdfFlag)
        lang -> outputPdfPath
      }.toMap

      val textByLanguage = OcrMyPdfExtractor.postProcessPdf(pdDocuments, blob.uri, pageService, previewStorage, index)
      handleOcrTranslation(blob.uri, textByLanguage, index, ingestionServices, params)
    } finally {

      FileUtils.deleteDirectory(tmpDir.toFile)
    }
  }

}

object OcrMyPdfExtractor extends Logging {

  private[extraction] def preProcessPdf(blob: Blob, file: File, tmpDir: Path, stdErrLogger: OcrStderrLogger ): Option[Path] = {
    val largeVectors = Using(Loader.loadPDF(file)) { doc =>
      Ocr.hasLargeVectorContent(file, doc)
    } match {
      case Success(largeVectors) => largeVectors
      case Failure(exception) =>
        logger.warn(s"Failed to inspect ${blob.uri} with pdfbox - will assume no large vectors", exception)
        false
    }
    val biggerThanA1 = Ocr.hasPagesBiggerThanA1(file.toPath, stdErrLogger)
    val preProcessedPdf = Ocr.preProcessPdf(file.toPath, tmpDir, stdErrLogger, biggerThanA1, largeVectors)
    preProcessedPdf
  }

  def getFullText(pages: List[Page]): Map[Language, String] = {
    pages.foldLeft(Map.empty[Language, String]) { (acc, page) =>
      page.value.foldLeft(acc) { case (acc, (lang, value)) =>
        acc + (lang -> (acc.getOrElse(lang, "") + value))
      }
    }
  }

  def insertFullText(uri: Uri, textByLanguage: Map[Language, String], index: Index)(implicit ec: ExecutionContext): Unit = {
    textByLanguage.foreach { case (lang, value) =>
      val optionalText = if (value.trim().isEmpty) None else Some(value)
      index.addDocumentOcr(uri, optionalText, lang).await(10.seconds)
    }
  }

  private[extraction] def postProcessPdf(ocrOutput: Map[Language, Path], blobUri: Uri, pageService: Pages, previewStorage: ObjectStorage, index: Index)(implicit ec: ExecutionContext): Map[Language, String] = {
    var pdDocuments: Map[Language, (Path, PDDocument)] = Map.empty
    try {
      ocrOutput.foreach { case (lang, path) =>
        val doc = Loader.loadPDF(path.toFile)
        pdDocuments += lang -> (path, doc)
      }
      // All docs have the same number of pages with the same dimensions, just different text from the OCR run per language
      val (_, (_, firstDoc)) = pdDocuments.headOption.getOrElse {
        throw new IllegalStateException(s"No OCR output produced for ${blobUri.value}. This may be because the languages list was empty")
      }
      val numberOfPages = firstDoc.getNumberOfPages

      val base = (List.empty[Page], 0.0)

      val (pages, _) = (1 to numberOfPages).foldLeft(base) { case ((pages, offsetHeight), pageNumber) =>
        val page = firstDoc.getPage(pageNumber - 1)
        val pageBoundingBox = page.getMediaBox
        val isRotatedSideways = page.getRotation % 180 != 0
        val effectiveWidth = if (isRotatedSideways) pageBoundingBox.getHeight else pageBoundingBox.getWidth
        val effectiveHeight = if (isRotatedSideways) pageBoundingBox.getWidth else pageBoundingBox.getHeight

        val dimensions = PageDimensions(
          width = effectiveWidth,
          height = effectiveHeight,
          top = offsetHeight,
          bottom = offsetHeight + effectiveHeight
        )

        val textByLanguage = pdDocuments.map { case (lang, (_, doc)) =>
          assert(doc.getNumberOfPages == numberOfPages, s"Number of pages mismatch across languages: ${pdDocuments.view.mapValues(_._2.getNumberOfPages).toMap}")

          val reader = new PDFTextStripper()
          reader.setStartPage(pageNumber)
          reader.setEndPage(pageNumber)

          val text = reader.getText(doc)
          lang -> text
        }

        (pages :+ Page(pageNumber, textByLanguage, dimensions), dimensions.bottom)
      }

      // Write to the page index in Elasticsearch - a document in the index corresponds to a single page
      pageService.addPageContents(blobUri, pages).await(30.seconds)

      // Upload each page to S3, per language. This is because OCRing English produces totally different output to OCRing
      // Russian for example so we store each page and decide later which one to serve the viewer
      pdDocuments.foreach { case (lang, (path, doc)) =>
        (1 to numberOfPages).foreach { pageNumber =>
          val page = doc.getPage(pageNumber - 1)
          uploadPageAsSeparatePdf(blobUri, lang, pageNumber, page, previewStorage)
        }

        // Upload the entire document to S3, per language. We serve these to the client as a download of the whole doc
        // TODO MRB: stop overwriting when we are OCRing against multiple languages?
        previewStorage.create(blobUri.toStoragePath, path, Some("application/pdf")).fold(failure => throw failure.toThrowable, identity)
      }

      val textByLanguage = OcrMyPdfExtractor.getFullText(pages)
      OcrMyPdfExtractor.insertFullText(blobUri, textByLanguage, index)
      textByLanguage
    } finally {
      pdDocuments.foreach { case (_, (path, doc)) =>
        doc.close()
        Files.deleteIfExists(path)
      }
    }

  }

  private def uploadPageAsSeparatePdf(blobUri: Uri, language: Language, pageNumber: Int, page: PDPage, previewStorage: ObjectStorage): Unit = {
    val doc = new PDDocument()
    val tempFile = Files.createTempFile(s"${language.key}-${blobUri.value}-${pageNumber}", ".pdf")

    try {
      doc.importPage(page)
      doc.save(tempFile.toFile)

      val key = PreviewService.getPageStoragePath(blobUri, language, pageNumber)
      previewStorage.create(key, tempFile, Some("application/pdf")).fold(failure => throw failure.toThrowable, identity)
    } finally {
      doc.close()
      Files.deleteIfExists(tempFile)
    }
  }
}
