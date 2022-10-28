package controllers.api

import akka.NotUsed
import akka.actor.{ActorSystem, ClassicActorSystemProvider}
import akka.stream.scaladsl.SourceQueueWithComplete
import akka.stream.{Materializer, OverflowStrategy}
import akka.stream.scaladsl.Source
import commands.{GetPagePreview, GetResource, ResourceFetchMode}
import model.frontend.{Chips, HighlightableText, TextHighlight}
import model.index.{FrontendPage, HighlightForSearchNavigation, PageHighlight}
import model.{Language, Languages, Uri}
import org.apache.pdfbox.pdmodel.PDDocument
import play.api.http.ContentTypes
import play.api.libs.EventSource
import play.api.libs.json.Json
import play.api.mvc.{ResponseHeader, Result}
import services.ObjectStorage
import services.annotations.Annotations
import services.index.{Index, Pages2}
import services.manifest.Manifest
import services.previewing.PreviewService
import utils.PDFUtil
import utils.attempt.Attempt
import utils.controller.{AuthApiController, AuthControllerComponents}

import scala.concurrent.Future

class PagesController(val controllerComponents: AuthControllerComponents, manifest: Manifest,
    index: Index, pagesService: Pages2, annotations: Annotations, previewStorage: ObjectStorage, materializer: Materializer) extends AuthApiController {

  def getPageCount(uri: Uri) = ApiAction.attempt { req =>

    pagesService.getPageCount(uri).map(count => Ok(Json.obj("pageCount" -> count)))
  }

  // Get language and highlight data for a given page
  // This expects searchQuery to have already been run through Chips.parseQueryString
  private def frontendPageFromQuery(uri: Uri, pageNumber: Int, username: String, searchQuery: Option[String], findQuery: Option[String]): Attempt[FrontendPage] = {
    val getResource = GetResource(uri, ResourceFetchMode.Basic, username, manifest, index, annotations, controllerComponents.users).process()
    val getPage = pagesService.getPageGeometries(uri, pageNumber, searchQuery, findQuery)

    for {
      // Check we have permission to see this file
      _ <- getResource
      page <- getPage
      allLanguages = page.value.keySet
      // Highlighting stuff
      searchHighlights = dedupeHighlightSpans(page.page, page.value, false)
      findHighlights = page.highlightedText.map { langMap =>
        dedupeHighlightSpans(page.page, langMap, true)
      }.getOrElse(Map.empty)
      highlights <- getHighlightGeometriesForPage(uri, pageNumber, searchHighlights, findHighlights)
    } yield {
      FrontendPage(pageNumber, allLanguages.head, allLanguages, page.dimensions, highlights.flatMap(_.highlights).toList)
    }
  }

  // Get language and highlight data for a given page
  def getPageData(uri: Uri, pageNumber: Int, sq: Option[String], fq: Option[String]) = ApiAction.attempt { req =>
    for {
      response <- frontendPageFromQuery(uri, pageNumber, req.user.username, sq.map(Chips.parseQueryString), fq)
    } yield {
      Ok(Json.toJson(response))
    }
  }

  case class HighlightGeometries(lang: Language, highlights: List[PageHighlight])

  private def getHighlightGeometriesForPage(uri: Uri,
                                   pageNumber: Int,
                                   highlights: Map[Language, List[TextHighlight]],
                                   findHighlights: Map[Language, List[TextHighlight]]) = {
    val previewPaths = (highlights.keySet ++ findHighlights.keySet).map { lang =>
      lang -> PreviewService.getPageStoragePath(uri, lang, pageNumber)
    }

    Attempt.sequence(previewPaths.map { case (lang, path) =>
      previewStorage.get(path).toAttempt.map { pdfData =>
        try {
          val pdf = PDDocument.load(pdfData)

          try {
            val highlightSpans = highlights.getOrElse(lang, Nil)
            val findHighlightSpans = findHighlights.getOrElse(lang, Nil)

            val highlightGeometries = PDFUtil.getSearchResultHighlights(highlightSpans, pdf, pageNumber, false)
            val findHighlightGeometries = PDFUtil.getSearchResultHighlights(findHighlightSpans, pdf, pageNumber, true)

            HighlightGeometries(lang, highlightGeometries ++ findHighlightGeometries)
          } finally {
            pdf.close()
          }
        } finally {
          pdfData.close()
        }
      }
    })
  }


  // This is pretty ugly, probably super inefficient too...
  // It basically pulls out the individual highlight spans for each language and then deduplicates ones that appear
  // in multiple langauges. This allows us to avoid calculating highlight geometry for multiple languages when the
  // highlight is the same.
  // This is good because it allows us to minimise the number of downloads from S3 in the common case.
  private def dedupeHighlightSpans(page: Long, valueMap: Map[Language, String], isFind: Boolean): Map[Language, List[TextHighlight]] = {
    valueMap.toList.flatMap { case (lang, text) =>
      val hlText = HighlightableText.fromString(text, Some(page), isFind)
      hlText.highlights.map(span => (lang, span))
    }.groupBy(_._2).toList.map { case (lang, commonSpans) =>
      commonSpans.head
    }.groupBy(_._1).view.mapValues(_.map(_._2)).filter { case (k, v) =>
      v.nonEmpty
    }.toMap
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

  private def createSourceOfHighlights(): (SourceQueueWithComplete[FrontendPage], Source[FrontendPage, NotUsed]) = {
    val initialSourceOfStatuses = Source.queue[FrontendPage](100, OverflowStrategy.dropHead)
    initialSourceOfStatuses.preMaterialize()(materializer)
  }

  private def getHighlights(uri: Uri, query: String, username: String, isSearch: Boolean): Attempt[Seq[HighlightForSearchNavigation]] = {
    val searchQuery = if (isSearch) Some(query) else None
    val findQuery = if (isSearch) None else Some(query)
    for {
      pagesWithHits <- pagesService.findInPages(uri, query)
      pageData <- Attempt.sequence(
        pagesWithHits.map(frontendPageFromQuery(uri, _, username, searchQuery, findQuery))
      )
    } yield {
      val highlights = for {
        page <- pageData
        highlight <- page.highlights
      } yield {
        HighlightForSearchNavigation.fromPageHighlight(page.page, highlight.index, highlight)
      }

      highlights.sortBy(h => (h.pageNumber, h.highlightNumber))
    }
  }

  private def getHighlightsStream(sourceQueue: SourceQueueWithComplete[FrontendPage], uri: Uri, query: String, username: String, isSearch: Boolean): Attempt[Unit] = {
    val searchQuery = if (isSearch) Some(query) else None
    val findQuery = if (isSearch) None else Some(query)
    for {
      pagesWithHits <- pagesService.findInPages(uri, query)
    } yield {
      pagesWithHits.foreach(page => {
        frontendPageFromQuery(uri, page, username, searchQuery, findQuery).map { frontendPage =>
          sourceQueue.offer(frontendPage)
        }
      })

      ()
    }
  }

  // This endpoint is used to get highlights for "find in document" on-demand queries.
  def findInDocument(uri: Uri, q: String) = ApiAction.attempt { req =>
    getHighlights(uri, q, req.user.username, isSearch = false).map(highlights =>
      Ok(Json.toJson(highlights))
    )
  }

  def findInDocumentStream(uri: Uri, q: String) = ApiAction { req =>
    val (sourceQueue, sourceOfFrontendPages) = createSourceOfHighlights()
    getHighlightsStream(sourceQueue, uri, q, req.user.username, isSearch = false)

    val sourceOfHighlights = sourceOfFrontendPages.map(frontendPage => {
      (for {
        highlight <- frontendPage.highlights
      } yield {
        HighlightForSearchNavigation.fromPageHighlight(frontendPage.page, highlight.index, highlight)
      }).toString
    })

    Right(Ok.chunked(sourceOfHighlights via EventSource.flow)
      .as(ContentTypes.EVENT_STREAM)
      .withHeaders("Cache-Control" -> "no-cache")
      .withHeaders("Connection" -> "keep-alive"))
  }

  // This endpoint is used to get highlights for the "search across documents" query which
  // should be fixed for the lifetime of the page viewer of a given document.
  // It behaves identically to the findInDocument endpoint, except that it expects its query to be in
  // a JSON format that may contain chips, and it returns highlight ids with a different prefix.
  def searchInDocument(uri: Uri, q: String) = ApiAction.attempt { req =>
    getHighlights(uri, Chips.parseQueryString(q), req.user.username, isSearch = true).map(highlights =>
      Ok(Json.toJson(highlights))
    )
  }
}
