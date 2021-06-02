package services.index

import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.requests.searches.queries.Query
import com.sksamuel.elastic4s.requests.searches.{HighlightField, MultisearchResponseItem}
import model.index.{Page, PageResult, PagesSummary}
import model.{Language, Languages, Uri}
import services.ElasticsearchSyntax
import services.index.HitReaders.{PageHitReader, RichFieldMap}
import utils.Logging
import utils.attempt.{Attempt, ElasticSearchQueryFailure, MultipleFailures, NotFoundFailure}

import scala.concurrent.ExecutionContext

class ElasticsearchPages(val client: ElasticClient, indexNamePrefix: String)(implicit val ex: ExecutionContext) extends Pages with ElasticsearchSyntax with Logging {
  val textIndexName = s"$indexNamePrefix-text"

  override def setup(): Attempt[Pages] = {
    createIndexIfNotAlreadyExists(textIndexName,
      properties(
        keywordField(PagesFields.resourceId),
        intField(PagesFields.page),
        emptyMultiLanguageField(PagesFields.value),
        objectField(PagesFields.dimensions).fields(
          floatField(PagesFields.width),
          floatField(PagesFields.height),
          floatField(PagesFields.top),
          floatField(PagesFields.bottom)
        )
      )
    ).flatMap { _ =>
      Attempt.sequence(Languages.all.map(addLanguage))
    }.map { _ =>
      this
    }
  }

  def addLanguage(language: Language)= executeNoReturn {
    putMapping(textIndexName).as(
      multiLanguageField(PagesFields.value, language)
    )
  }

  override def addPageContents(uri: Uri, pages: Seq[Page]): Attempt[Unit] = {
    val ops = pages.map { page =>
      indexInto(textIndexName)
        .id(s"${uri.value}-${page.page}")
        .fields(
          Map(
            PagesFields.resourceId -> uri.value,
            PagesFields.page -> page.page,
            PagesFields.value -> page.value.map { case(lang, value) => lang.key -> value },
            s"${PagesFields.dimensions}.${PagesFields.width}" -> page.dimensions.width,
            s"${PagesFields.dimensions}.${PagesFields.height}" -> page.dimensions.height,
            s"${PagesFields.dimensions}.${PagesFields.top}" -> page.dimensions.top,
            s"${PagesFields.dimensions}.${PagesFields.bottom}" -> page.dimensions.bottom
          )
        )
    }

    executeBulk(ops)
  }

  override def getTextPages(uri: Uri, top: Double, bottom: Double, highlightQuery: Option[String]): Attempt[PageResult] = for {
    total <- getTotalPageCount(textIndexName, uri)
    totalHeight <- getTotalHeight(textIndexName, uri)

    query = highlightQuery.map(buildQuery)
    highlightFields = query.toList.flatMap { query =>
      HighlightFields.languageHighlighters(PagesFields.value, query)
        // Ensure we get the whole page, not just the highlights
        .map(_.numberOfFragments(0))
    }

    pages <- getPages(textIndexName, uri, top, bottom, query, highlightFields)
    pagesWithNextAndPreviousHighlights <- getPagesWithNextAndPreviousHighlights(textIndexName, uri, highlightQuery, highlightFields, pages)
  } yield {
    PageResult(
      PagesSummary(total, totalHeight),
      distinctByPageNumber(pages ::: pagesWithNextAndPreviousHighlights)
    )
  }

  override def getPage(uri: Uri, pageNumber: Int, highlightQuery: Option[String]): Attempt[Page] = {
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

  // TODO MRB: collapse total page count and height into fields on the document itself
  private def getTotalPageCount(indexName: String, uri: Uri): Attempt[Long] = {
    execute {
      count(indexName).query(
        termQuery(PagesFields.resourceId, uri.value),
      )
    }.map { resp =>
      resp.count
    }
  }

  private def getTotalHeight(indexName: String, uri: Uri): Attempt[Double] = {
    execute {
      search(indexName).query(
        should(matchAllQuery()).filter(termQuery(PagesFields.resourceId, uri.value))
      )
        .size(0)
        .aggs(sumAgg("total_height",s"${PagesFields.dimensions}.${PagesFields.height}"))
    }.map { resp =>
      resp.aggregations.data.objectField("total_height").doubleField("value")
    }
  }

  private def getPages(indexName: String, uri: Uri, top: Double, bottom: Double, query: Option[Query], highlightFields: List[HighlightField]): Attempt[List[Page]] = {
    val rangeFilters = List(
      rangeQuery(s"${PagesFields.dimensions}.${PagesFields.bottom}").gt(top),
      rangeQuery(s"${PagesFields.dimensions}.${PagesFields.top}").lt(bottom)
    )

    val filters = List(termQuery(PagesFields.resourceId, uri.value)) ++ rangeFilters

    // TODO MRB: removed the size parameter so can bring in total count and agg size to a single query
    execute {
      search(indexName).query(
        should(query.getOrElse(matchAllQuery()))
          .filter(filters)
      )
        .sortBy(fieldSort(PagesFields.page).asc())
        .highlighting(highlightFields)

    }.flatMap { resp =>
      val pages = resp.to[Page].toList

      if(pages.isEmpty) {
        // TODO: this could also occur if the viewport passed from the client didn't match any pages
        // strictly speaking should this only be a 404 if no pages are found for the given blob ID?
        // In practice we don't think it matters and we have full control of the client code at the moment so can always
        // change the response here as needed
        Attempt.Left(NotFoundFailure(s"No pages found for ${uri.value}"))
      } else {
        Attempt.Right(pages)
      }
    }
  }

  private def getPagesWithNextAndPreviousHighlights(indexName: String, uri: Uri, highlightQuery: Option[String], highlightFields: List[HighlightField], pagesInViewport: List[Page]): Attempt[List[Page]] = {
    highlightQuery match {
      case None =>
        Attempt.Right(List.empty)

      case Some(q) =>
        val firstPageInViewport = pagesInViewport.minBy(_.page).page
        val lastPageInViewport = pagesInViewport.maxBy(_.page).page

        val query = buildQuery(q)
        val documentFilter = termQuery(PagesFields.resourceId, uri.value)

        execute {
          multi(
            // The first page to contain highlights
            search(indexName)
              .sortByFieldAsc(PagesFields.page)
              .highlighting(highlightFields)
              .size(1)
              .query(
                // NB this is a "must" rather than a "should" so we only return pages containing highlights
                must(query).filter(documentFilter)
              ),
            // The last page to contain highlights PRIOR to the FIRST page in the viewport
            search(indexName)
              .sortByFieldDesc(PagesFields.page)
              .highlighting(highlightFields)
              .size(1)
              .query(
                must(query).filter(
                  documentFilter,
                  rangeQuery(PagesFields.page).lt(firstPageInViewport)
                )
              ),
            // The first page to contain highlights AFTER the LAST page in the viewport
            search(indexName)
              .sortByFieldAsc(PagesFields.page)
              .highlighting(highlightFields)
              .size(1)
              .query(
                must(query).filter(
                  documentFilter,
                  rangeQuery(PagesFields.page).gt(lastPageInViewport)
                )
              ),
            // The last page to contain highlights
            search(indexName)
              .sortByFieldDesc(PagesFields.page)
              .highlighting(highlightFields)
              .size(1)
              .query(
                must(query).filter(documentFilter)
              )
          )
        }.flatMap { response =>
          val results = response.items.collect { case MultisearchResponseItem(_, _, Right(result)) => result }

          val errors = response.items.collect { case MultisearchResponseItem(_, status, Left(err)) =>
            ElasticSearchQueryFailure(new IllegalStateException(err.toString), status, None)
          }

          if(errors.nonEmpty) {
            Attempt.Left(MultipleFailures(errors.toList))
          } else {
            val pointers = results.flatMap(_.hits.hits).map(_.to[Page]).sortBy(_.page)

            if(pointers.isEmpty) {
              Attempt.Right(List.empty)
            } else {
              val min = pointers.head
              val max = pointers.last

              val maybePrior = pointers.reverse.find(_.page < firstPageInViewport)
              val maybeAfter = pointers.find(_.page > lastPageInViewport)

              val prior = maybePrior.getOrElse(max) // wraparound
              val after = maybeAfter.getOrElse(min)

              Attempt.Right(distinctByPageNumber(List(after, prior)))
            }
          }
        }
    }
  }

  private def distinctByPageNumber(pages: List[Page]): List[Page] =
    pages
      .groupBy(_.page)
      .values
      .map(_.head)
      .toList

  private def buildQuery(q: String) =
    queryStringQuery(q)
      .defaultOperator("and")
      .field(s"${PagesFields.value}.*")
      .quoteFieldSuffix(".exact")
}

object PagesFields {
  val resourceId = "resourceId"
  val page = "page"
  val value = "value"
  val dimensions = "dimensions"
  val width = "width"
  val height = "height"
  val top = "top"
  val bottom = "bottom"
  val total = "total"
}
