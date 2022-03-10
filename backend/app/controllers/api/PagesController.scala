package controllers.api

import commands.GetPages.PagePreviewMetadata

import java.io.InputStream
import commands.{GetPagePreview, GetPages, GetResource, ResourceFetchMode}
import model.frontend.{Chips, HighlightableText, TextHighlight}
import model.index.{FrontendPage, Page, PageHighlight, PageWithImpromptuSearch}
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
import utils.attempt.{Attempt, IllegalStateFailure}
import utils.controller.{AuthApiController, AuthControllerComponents}

import scala.collection.breakOut

class PagesController(val controllerComponents: AuthControllerComponents, manifest: Manifest,
    index: Index, pagesService: Pages2, annotations: Annotations, previewStorage: ObjectStorage) extends AuthApiController {

  def getPageCount(uri: Uri) = ApiAction.attempt { req =>
    pagesService.getPageCount(uri).map(count => Ok(Json.obj("pageCount" -> count)))
  }

  // Get language and highlight data for a given page
  def getPageData(uri: Uri, pageNumber: Int, q: Option[String], iq: Option[String], language: Option[Language]) = ApiAction.attempt { req =>
    val query = q.map(Chips.parseQueryString)

    val getResource = GetResource(uri, ResourceFetchMode.Basic, req.user.username, manifest, index, annotations, controllerComponents.users).process()
    val getPage = pagesService.getPageGeometries(uri, pageNumber, query)

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

  // Gets highlights across all languages, deduplicating where possible
  private def getLanguagesWithHighlights(page: PageWithImpromptuSearch)  = {
    val allLanguages = page.value.keySet

    val highlights: Map[Language, List[TextHighlight]] = dedupHighlightSpans(page.page, page.value)
    val impromptuHighlights: Map[Language, List[TextHighlight]] = page.impromptuSearchValue.map { langMap =>
      dedupHighlightSpans(page.page, langMap)
    }.getOrElse(Nil)
  }

  // This is pretty ugly, probably super ineffient too...
  // It basically pulls out the individual highlight spans for each language and then deduplicates ones that appear
  // in multiple langauges. This allows us to avoid calculating highlight geometry for multiple languages when the
  // highlight is the same.
  // This is good because it allows us to minimise the number of downloads from S3 in the common case.
  private def dedupHighlightSpans(page: Long, valueMap: Map[Language, String]): Map[Language, List[TextHighlight]] = {
    valueMap.toList.flatMap { case (lang, text) =>
      val hlText = HighlightableText.fromString(text, Some(page))
      hlText.highlights.map(span => (lang, span))
    }.groupBy(_._2).toList.map { case (lang, commonSpans) =>
      commonSpans.head
    }.groupBy(_._1).mapValues(_.map(_._2))
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

  def impromptuSearch(uri: Uri, q: String) = ApiAction.attempt {
    pagesService.searchPages(uri, q).map( res =>
      Ok(Json.toJson(res))
    )
  }
}
