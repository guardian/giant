package services.index

import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.ElasticDsl._
import services.index.HitReaders.{HitToRichFieldMap, PageHitReader, RichFieldMap}
import com.sksamuel.elastic4s.requests.searches.queries.Query
import com.sksamuel.elastic4s.requests.searches.{HighlightField, MultisearchResponseItem, SearchRequest}
import model.Uri
import model.frontend.Highlight
import model.index.{Page, PageWithFind}
import services.ElasticsearchSyntax
import utils.Logging
import utils.attempt.{Attempt, ElasticSearchQueryFailure, MultipleFailures, NotFoundFailure}

import scala.concurrent.ExecutionContext

class Pages2(val client: ElasticClient, indexNamePrefix: String)(implicit val ex: ExecutionContext)
  extends ElasticsearchSyntax with Logging {
  val textIndexName = s"$indexNamePrefix-text"

  private def firstPageExistsInNewIdFormat(uri: Uri): Attempt[Boolean] = {
    // Only count documents whose id is of the format `{documentHash}-{pageNumber}`,
    // to avoid telling the frontend to try and render documents that were uploaded before
    // the id format changed in https://github.com/guardian/pfi/pull/884 and https://github.com/guardian/pfi/pull/886
    execute {
      count(textIndexName).query(
        termQuery("_id", s"${uri.value}-1")
      )
    }.map { resp =>
      resp.count > 0
    }
  }

  private def pageCount(uri: Uri): Attempt[Long] = {
    execute {
      count(textIndexName).query(
        termQuery(PagesFields.resourceId, uri.value)
      )
    }.map { resp =>
      resp.count
    }
  }

  def getPageCount(uri: Uri): Attempt[Long] = {
    for {
      hasPages <- firstPageExistsInNewIdFormat(uri)
      count <- pageCount(uri)
    } yield {
      if (!hasPages) {
        0
      } else {
        count
      }
    }
  }

  // Get geometries for a given page (page geometry and highlights)
  def getPageGeometries(uri: Uri, pageNumber: Int, searchQuery: Option[String], findQuery: Option[String]): Attempt[PageWithFind] = {
    val searchHighlightFields = buildHighlightFields(searchQuery)
    val findHighlightFields = buildHighlightFields(findQuery)

    val indexId = s"${uri.value}-$pageNumber"
    val queries =
      List(
        Some(
          search(textIndexName)
            .termQuery("_id", indexId)
            .highlighting(searchHighlightFields)
        ),
        findQuery.map { _ =>
          search(textIndexName)
            .termQuery("_id", indexId)
            .highlighting(findHighlightFields)
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
            val page = pages.headOption
            page match {
              case None => Attempt.Left(NotFoundFailure(s"No page found in elasticsearch with id ${indexId}"))
              case Some(page) =>
                // This is attempting to get the second element from the results,
                // which will contain find highlights if they were requested.
                val pageWithFindHighlights = pages.lift(1)

                Attempt.Right(
                  PageWithFind(page.page, page.value, pageWithFindHighlights.map(_.value), page.dimensions)
                )
            }
          }
        }
  }

  // This function is used to search within the page index to find highlights for a given query
  // it can be reused for find search and for regular highlighting.
  def findInPages(uri: Uri, findQuery: String): Attempt[Seq[Int]] = {
    val query = buildQuery(findQuery)

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
      val matchingPages: Seq[Int] = response.hits.hits.map(_.field[Int](PagesFields.page)).distinct.sorted.toIndexedSeq

      Attempt.Right(matchingPages)
    }
  }

  private def buildQuery(query: String) =
    queryStringQuery(query)
    .defaultOperator("and")
    .field(s"${PagesFields.value}.*")
    .quoteFieldSuffix(".exact")

  private def buildHighlightFields(query: Option[String]) =
    query.map(buildQuery).toList.flatMap { query =>
      HighlightFields.languageHighlighters(PagesFields.value, query)
        // Ensure we get the whole page, not just the highlights
        .map(_.numberOfFragments(0))
    }
}
