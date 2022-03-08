package commands

import model.frontend.HighlightableText
import model.{Language, Uri}
import model.index.{FrontendPage, FrontendPageResult, Page, PageHighlight, PageResult}
import org.apache.pdfbox.pdmodel.PDDocument
import services.ObjectStorage
import services.index.Pages
import services.previewing.PreviewService
import utils.PDFUtil
import utils.attempt.{Attempt, IllegalStateFailure}

import java.io.InputStream
import scala.concurrent.ExecutionContext

class GetPages(uri: Uri, top: Double, bottom: Double, query: Option[String], userRequestedLanguage: Option[Language],
               pagesService: Pages, previewStorage: ObjectStorage)(implicit ec: ExecutionContext) extends AttemptCommand[FrontendPageResult] {

  override def process(): Attempt[FrontendPageResult] = {
    for {
      pages <- pagesService.getTextPages(uri, top, bottom, query)
      response <- addSearchHighlightsToResponse(pages, uri, userRequestedLanguage)
    } yield {
      response
    }
  }

  private def addSearchHighlightsToResponse(result: PageResult, uri: Uri, userRequestedLanguage: Option[Language]): Attempt[FrontendPageResult] = {
    val frontendPages: List[Attempt[FrontendPage]] = result.pages.map { page =>
      val pageNumber = page.page.toInt
      val allLanguages = page.value.keySet

      for {
        metadata <- GetPages.getPagePreviewMetadata(uri, page, userRequestedLanguage)
        previewUri = PreviewService.getPageStoragePath(uri, metadata.language, pageNumber)
        pagePreviewPdf <- previewStorage.get(previewUri).toAttempt
        highlights <- if(metadata.hasHighlights) {
          addSearchHighlightsToPageResponse(pageNumber, pagePreviewPdf, metadata.pageText)
        } else {
          pagePreviewPdf.close()
          Attempt.Right(List.empty)
        }
      } yield {
        // FIXME? Why don't we just return the PDF data here? This would save the
        FrontendPage(pageNumber, metadata.language, allLanguages, page.dimensions, highlights)
      }
    }

    Attempt.sequence(frontendPages).map(FrontendPageResult(result.summary, _))
  }

  private def addSearchHighlightsToPageResponse(pageNumber: Int, pageData: InputStream, pageText: String): Attempt[List[PageHighlight]] = Attempt.catchNonFatalBlasé {
    try {
      val pagePDF = PDDocument.load(pageData)
      val highlightableText = HighlightableText.fromString(pageText, Some(pageNumber))

      PDFUtil.getSearchResultHighlights(highlightableText, pagePDF, pageNumber)
    } finally {
      pageData.close()
    }
  }
}

object GetPages {
  case class PagePreviewMetadata(language: Language, pageText: String, hasHighlights: Boolean)

  // TODO SC/JS: This name is a bit wrong - its not simply metadata, it's language choice and *actual* data
  def getPagePreviewMetadata(uri: Uri, page: Page, userRequestedLanguage: Option[Language]): Attempt[PagePreviewMetadata] = {
    val pageNumber = page.page.toInt
    val allLanguages = page.value.keySet

    // OcrMyPdfExtractor will have uploaded a PDF for each page of the document, per language requested
    // We need to decide which of these we will try use to generate rectangles for the highlights coming back from ES.
    //   - If the page is only indexed using one language, use the page for that language
    //   - If we only have highlights from ES for one language, use the page for that one
    // Otherwise just pick one. We might get it wrong, in which case the user will request a different language in the UI.

    val languageWithHighlights = page.value
      .collectFirst { case (lang, highlightedText) if highlightedText.contains("<result-highlight>") => lang }

    userRequestedLanguage.orElse(languageWithHighlights).orElse(page.value.keys.headOption) match {
      case Some(language) =>
        Attempt.Right(PagePreviewMetadata(language, page.value(language), languageWithHighlights.nonEmpty))

      case _ =>
        Attempt.Left(IllegalStateFailure(s"Unable to determine language for highlights for page $pageNumber of $uri. Languages: $allLanguages"))
    }
  }
}
