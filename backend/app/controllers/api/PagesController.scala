package controllers.api

import java.io.InputStream

import commands.{GetPagePreview, GetPages, GetResource, ResourceFetchMode}
import model.frontend.{Chips, HighlightableText}
import model.index.{FrontendPage, PageHighlight}
import model.{Language, Languages, Uri}
import org.apache.pdfbox.pdmodel.PDDocument
import play.api.libs.json.Json
import play.api.mvc.{ResponseHeader, Result}
import services.ObjectStorage
import services.annotations.Annotations
import services.manifest.Manifest
import services.index.{Index, Pages2}
import services.previewing.PreviewService
import utils.PDFUtil
import utils.attempt.Attempt
import utils.controller.{AuthApiController, AuthControllerComponents}

class PagesController(val controllerComponents: AuthControllerComponents, manifest: Manifest,
    index: Index, pagesService: Pages2, annotations: Annotations, previewStorage: ObjectStorage) extends AuthApiController {

  def getPageCount(uri: Uri) = ApiAction.attempt { req =>
    pagesService.getPageCount(uri).map(count => Ok(Json.obj("pageCount" -> count)))
  }

  // Get language and highlight data for a given page
  def getPageData(uri: Uri, pageNumber: Int, q: Option[String], language: Option[Language]) = ApiAction.attempt { req =>
    val query = q.map(Chips.parseQueryString)

    val getResource = GetResource(uri, ResourceFetchMode.Basic, req.user.username, manifest, index, annotations, controllerComponents.users).process()
    val getPage = pagesService.getPage(uri, pageNumber, query)

    for {
      // Check we have permission to see this file
      _ <- getResource
      page <- getPage
      allLanguages = page.value.keySet
      // Highlighting stuff
      metadata <- GetPages.getPagePreviewMetadata(uri, page, language)
      previewUri = PreviewService.getPageStoragePath(uri, metadata.language, pageNumber)
      pagePreviewPdf <- previewStorage.get(previewUri).toAttempt
      highlights <- if(metadata.hasHighlights) {
        addSearchHighlightsToPageResponse(pageNumber, pagePreviewPdf, metadata.pageText)
      } else {
        pagePreviewPdf.close()
        Attempt.Right(List.empty)
      }
    } yield {
      val response = FrontendPage(pageNumber, metadata.language, allLanguages, page.dimensions, highlights)
      Ok(Json.toJson(response))
    }
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

  def getPagePreview(uri: Uri, pageNumber: Int) = ApiAction.attempt { req =>
    val getResource = GetResource(uri, ResourceFetchMode.Basic, req.user.username, manifest, index, annotations, controllerComponents.users).process()
    val getPagePreview =  new GetPagePreview(uri, Languages.getByKeyOrThrow("english"), pageNumber, previewStorage).process()

    for {
      // Check we have permission to see this file
      _ <- getResource
      response <- getPagePreview
    } yield {
      Result(ResponseHeader(200, Map.empty), response)
    }
  }
}
