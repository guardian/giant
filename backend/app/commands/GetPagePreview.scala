package commands

import akka.stream.scaladsl.StreamConverters
import akka.util.ByteString
import model.frontend.HighlightableText
import model.index.Page
import model.{Language, Uri}
import org.apache.pdfbox.pdmodel.PDDocument
import play.api.http.HttpEntity
import play.api.mvc.{ResponseHeader, Result}
import services.ObjectStorage
import services.index.Pages
import services.previewing.PreviewService
import utils.PDFUtil
import utils.attempt.Attempt

import java.io.{ByteArrayOutputStream, InputStream}
import scala.concurrent.ExecutionContext

class GetPagePreview(uri: Uri, language: Language, pageNumber: Int, query: Option[String], annotateSearchHighlightsDirectlyOnPage: Boolean,
                     pagesService: Pages, previewStorage: ObjectStorage)(implicit ec: ExecutionContext) extends AttemptCommand[HttpEntity] {
  override def process(): Attempt[HttpEntity] = {
    val previewUri = PreviewService.getPageStoragePath(uri, language, pageNumber)

    // You can enable this to have the server add search highlights directly as annotations to the PDF
    // See preview.annotateSearchHighlightsDirectlyOnPage in application.conf
    // Unfortunately the current stable version of PDFjs (2.6.347) can't display them and even in the beta, it renders
    // them directly on to the canvas meaning we can't really navigate between them
    if(annotateSearchHighlightsDirectlyOnPage) {
      for {
        page <- pagesService.getPage(uri, pageNumber, query)
        pageData <- previewStorage.get(previewUri).toAttempt
      } yield {
        addSearchHighlightsInlineInPDF(page, pageData, language)
      }
    } else {
      for {
        pageData <- previewStorage.get(previewUri).toAttempt
      } yield {
        // StreamConverters.fromInputStream will close the stream for us once it's done
        HttpEntity.Streamed(StreamConverters.fromInputStream(() => pageData), None, Some("application/pdf"))
      }
    }
  }

  private def addSearchHighlightsInlineInPDF(page: Page, pageData: InputStream, language: Language): HttpEntity = {
    val pagePDF = PDDocument.load(pageData)

    val highlightableText = HighlightableText.fromString(page.value(language), Some(page.page))
    val highlightedPDF = PDFUtil.highlightSearchResultsInline(highlightableText, pagePDF)

    val highlightedPDFDataOut = new ByteArrayOutputStream()
    highlightedPDF.save(highlightedPDFDataOut)

    HttpEntity.Strict(ByteString(highlightedPDFDataOut.toByteArray), Some("application/pdf"))
  }
}
