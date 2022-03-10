package services.index

import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.ElasticDsl._
import services.index.HitReaders.{HitToRichFieldMap, PageHitReader, RichFieldMap}
import com.sksamuel.elastic4s.requests.searches.queries.Query
import com.sksamuel.elastic4s.requests.searches.{HighlightField, MultisearchResponseItem, SearchRequest}
import model.Uri
import model.frontend.Highlight
import model.index.Page
import services.ElasticsearchSyntax
import utils.Logging
import utils.attempt.{Attempt, ElasticSearchQueryFailure, MultipleFailures, NotFoundFailure}

import scala.concurrent.ExecutionContext

class Pages2(val client: ElasticClient, indexNamePrefix: String)(implicit val ex: ExecutionContext)
  extends ElasticsearchSyntax with Logging {
  val textIndexName = s"$indexNamePrefix-text"

  def getPageCount(uri: Uri): Attempt[Long] = {
    execute {
      count(textIndexName).query(
        termQuery(PagesFields.resourceId, uri.value),
      )
    }.map { resp =>
      resp.count
    }
  }

  // Get geometries for a given page (page geometry and highlights)
  def getPageGeometries(uri: Uri, pageNumber: Int, highlightQuery: Option[String]): Attempt[Page] = {
    val query = highlightQuery.map(buildQuery)
    val highlightFields = query.toList.flatMap { query =>
      HighlightFields.languageHighlighters(PagesFields.value, query)
        // Ensure we get the whole page, not just the highlights
        .map(_.numberOfFragments(0))
    }

    execute {
      search(textIndexName)
        .termQuery("_id", s"${uri.value}-$pageNumber")
        .highlighting(highlightFields)
    }.flatMap { response =>
      val pages = response.to[Page]

      if(pages.isEmpty) {
        Attempt.Left(NotFoundFailure(s"Missing page $pageNumber for $uri"))
      } else {
        Attempt.Right(pages.head)
      }
    }
  }

  // This function is used to search within the page index to find highlights for a given query
  // it can be reused for impromptu search and for regular highlighting.
  def searchPages(uri: Uri, q: String): Attempt[Seq[Int]] = {
    val query = buildQuery(q)

    val documentFilter = termQuery(PagesFields.resourceId, uri.value)

    execute {
        search(textIndexName)
        .size(500)
        .query(
          must(query).filter(
            documentFilter,
          )
        )
    }.flatMap { response =>
      // TODO should really be a map of language -> page matches
      val matchingPages: Seq[Int] = response.hits.hits.map(_.field[Int](PagesFields.page)).distinct.sorted

      Attempt.Right(matchingPages)
    }
  }

  private def buildQuery(q: String) =
    queryStringQuery(q)
    .defaultOperator("and")
    .field(s"${PagesFields.value}.*")
    .quoteFieldSuffix(".exact")
}
