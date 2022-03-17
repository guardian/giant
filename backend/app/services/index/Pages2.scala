package services.index

import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.ElasticDsl._
import services.index.HitReaders.{HitToRichFieldMap, PageHitReader, RichFieldMap}
import com.sksamuel.elastic4s.requests.searches.queries.Query
import com.sksamuel.elastic4s.requests.searches.{HighlightField, MultisearchResponseItem, SearchRequest}
import model.Uri
import model.frontend.Highlight
import model.index.{Page, PageWithImpromptuSearch}
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
  def getPageGeometries(uri: Uri, pageNumber: Int, highlightQuery: Option[String], impromptuHighlightQuery: Option[String]): Attempt[PageWithImpromptuSearch] = {
    val query = highlightQuery.map(buildQuery)
    val highlightFields = query.toList.flatMap { query =>
      HighlightFields.languageHighlighters(PagesFields.value, query)
        // Ensure we get the whole page, not just the highlights
        .map(_.numberOfFragments(0))
    }

    val impromptuQuery = impromptuHighlightQuery.map(buildQuery)
    val impromptuHighlightFields = impromptuQuery.toList.flatMap { query =>
      HighlightFields.languageHighlighters(PagesFields.value, query)
        .map(_.numberOfFragments(0))
    }

    val queries =
      List(
        Some(
          search(textIndexName)
            .termQuery("_id", s"${uri.value}-$pageNumber")
            .highlighting(highlightFields)
        ),
        impromptuQuery.map { _ =>
          search(textIndexName)
            .termQuery("_id", s"${uri.value}-$pageNumber")
            .highlighting(impromptuHighlightFields)
        }
      ).flatten

    execute {
      multi (
        queries
      )
    }.flatMap { response =>
          val results = response.items.collect { case MultisearchResponseItem(_, _, Right(result)) => result }
          val errors = response.items.collect { case MultisearchResponseItem(_, status, Left(err)) =>
            ElasticSearchQueryFailure(new IllegalStateException(err.toString), status, None)
          }

          if(errors.nonEmpty) {
            Attempt.Left(MultipleFailures(errors.toList))
          } else {
            val pages = results.flatMap(_.to[Page])

            val page = pages.head
            val impromptuSearchPage = pages.lift(1)

            Attempt.Right(
              PageWithImpromptuSearch(page.page, page.value, impromptuSearchPage.map(_.value), page.dimensions)
            )
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
        .size(501)
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
