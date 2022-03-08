package services.index

import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.ElasticDsl._
import services.index.HitReaders.{PageHitReader, RichFieldMap}
import com.sksamuel.elastic4s.requests.searches.queries.Query
import com.sksamuel.elastic4s.requests.searches.{HighlightField, MultisearchResponseItem}
import model.Uri
import model.index.Page
import services.ElasticsearchSyntax
import utils.Logging
import utils.attempt.{Attempt, NotFoundFailure}

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

  def getPage(uri: Uri, pageNumber: Int, highlightQuery: Option[String]): Attempt[Page] = {
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

  private def buildQuery(q: String) =
    queryStringQuery(q)
    .defaultOperator("and")
    .field(s"${PagesFields.value}.*")
    .quoteFieldSuffix(".exact")
}
