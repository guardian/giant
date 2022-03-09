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
  //
  // Data is returned in batches around the current page, and the first and last result this allows the client to
  // make requests less frequently. The query wraps around the beginning/end of the document if the current page is
  // close to the start or the end.
  //
  // The page count is sent to this query since we don't want to recalculate it. A client could lie to the API but
  // they'll just get garbage results so it shouldn't be a security issue.
  def searchPages(uri: Uri, currentPageNumber: Int, pageCount: Int, q: String): Attempt[Seq[Int]] = {
    val query = buildQuery(q)

    val documentFilter = termQuery(PagesFields.resourceId, uri.value)

    // The number of pages worth of highlights we'll get either side of the current page
    val pageSpan = 25

    var startLimit: Option[Int] = None
    var lowerLimit = currentPageNumber - pageSpan
    var upperLimit = currentPageNumber + pageSpan
    var endLimit: Option[Int] = None

    if (lowerLimit < 1) {
      endLimit = Some((currentPageNumber - pageSpan) % pageCount)
      lowerLimit = 1
    }

    if (upperLimit > pageCount) {
      startLimit = Some((currentPageNumber + pageSpan) % pageCount)
      upperLimit = pageCount
    }

    val queries: List[Option[SearchRequest]] = List(
      // Optional: Search from the first page forward
      startLimit.map(limit =>
        search(textIndexName)
          .size(limit) // Default is 10 but we possibly might wrap more than that
          .query(
            must(query).filter(
              documentFilter,
              rangeQuery(PagesFields.page).lte(limit)
            )
          )
      ),
      // Search around the current page
      Some(search(textIndexName)
        .size(2 * pageSpan + 1) // Default is 10, and we'll need more
        .query(
          must(query).filter(
            documentFilter,
            rangeQuery(PagesFields.page).gte(lowerLimit).lte(upperLimit)
          )
        )),
      // If we're wrapping around the end - search from the end
      endLimit.map(limit =>
        search(textIndexName)
          .size(pageCount - limit)
          .query(
            must(query).filter(
              documentFilter,
              rangeQuery(PagesFields.page).gte(limit)
            )
          )
      )
    )

    val definedQueries: List[SearchRequest] = queries.flatten

    execute {
      multi(
        definedQueries
      )
    }.flatMap { response =>
      val results = response.items.collect { case MultisearchResponseItem(_, _, Right(result)) => result }

      val errors = response.items.collect { case MultisearchResponseItem(_, status, Left(err)) =>
        ElasticSearchQueryFailure(new IllegalStateException(err.toString), status, None)
      }

      if (errors.nonEmpty) {
        Attempt.Left(MultipleFailures(errors.toList))
      } else {
        // TODO should really be a map of language -> page matches
        val matchingPages: Seq[Int] = results.flatMap(_.hits.hits).map(_.field[Int](PagesFields.page)).distinct.sorted

        Attempt.Right(matchingPages)
      }
    }
  }

  private def buildQuery(q: String) =
    queryStringQuery(q)
    .defaultOperator("and")
    .field(s"${PagesFields.value}.*")
    .quoteFieldSuffix(".exact")
}
