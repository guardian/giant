package controllers.api

import commands.GetPages.PagePreviewMetadata

import java.io.InputStream
import commands.{GetPagePreview, GetPages, GetResource, ResourceFetchMode}
import model.frontend.{Chips, HighlightableText, TextHighlight}
import model.index.{FindHighlight, FrontendPage, HighlightForSearchNavigation, Page, PageHighlight, PageWithFind}
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

class PagesController(val controllerComponents: AuthControllerComponents, manifest: Manifest,
    index: Index, pagesService: Pages2, annotations: Annotations, previewStorage: ObjectStorage) extends AuthApiController {

  def getPageCount(uri: Uri) = ApiAction.attempt { req =>
    pagesService.getPageCount(uri).map(count => Ok(Json.obj("pageCount" -> count)))
  }

  // Get language and highlight data for a given page
  private def pageData(uri: Uri, pageNumber: Int, username: String, sq: Option[String], fq: Option[String]): Attempt[FrontendPage] = {
    // Across documents
    val searchQuery = sq.map(Chips.parseQueryString)
    // Within document
    val findQuery = fq

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
    val response = pageData(uri, pageNumber, req.user.username, sq, fq)
    response.map { r => Ok(Json.toJson(r))}
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

          val highlightSpans = highlights.getOrElse(lang, Nil)
          val findHighlightSpans = findHighlights.getOrElse(lang, Nil)

          val highlightGeometries = PDFUtil.getSearchResultHighlights(highlightSpans, pdf, pageNumber, false)
          val findHighlightGeometries = PDFUtil.getSearchResultHighlights(findHighlightSpans, pdf, pageNumber, true)

          HighlightGeometries(lang, highlightGeometries ++ findHighlightGeometries)
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
    }.groupBy(_._1).mapValues(_.map(_._2)).filter { case (k, v) =>
      v.nonEmpty
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

  def findInDocument(uri: Uri, fq: String) = ApiAction.attempt { req =>
    val findQuery = fq

    for {
      pagesWithHits <- pagesService.findInPages(uri, findQuery)
      pageData <- Attempt.sequence(pagesWithHits.map(pageData(uri, _, req.user.username, None, Some(findQuery))))
    } yield {
      val highlights = pageData.flatMap { page =>
        page.highlights.map {
          highlight => HighlightForSearchNavigation.fromPageHighlight(page.page, highlight.index, highlight)
        }
      }
      Ok(Json.toJson(highlights.sortBy(h => (h.pageNumber, h.highlightNumber))))
    }
  }
}
