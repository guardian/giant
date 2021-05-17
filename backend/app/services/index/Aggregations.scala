package services.index

import java.time.format.DateTimeFormatter
import java.time.{Instant, LocalDateTime, ZoneOffset}

import com.sksamuel.elastic4s.requests.searches.SearchResponse
import com.sksamuel.elastic4s.requests.searches.aggs.responses.bucket.{HistogramBucket, TermBucket, Terms}
import model.frontend.{SearchAggregation, SearchAggregationBucket}

object Aggregations {
  private val yearsFormat = DateTimeFormatter.ofPattern("yyyy")
  private val monthsFormat = DateTimeFormatter.ofPattern("MM")

  def mimeTypes(resp: SearchResponse): SearchAggregation = {
    val grouped = resp.aggregations.result[Terms](IndexAggNames.mimeTypes).buckets.groupBy(b => s"${b.key.split("/").head}/")

    val aggs = grouped.map { case (mediaType, buckets) =>
      SearchAggregationBucket(
        mediaType,
        buckets.foldLeft(0L)((a, i) => a + i.docCount),
        Some(buckets.map(b => SearchAggregationBucket(b.key, b.docCount, None)).toList))
    }(collection.breakOut).toList

    SearchAggregation(IndexAggNames.mimeTypes, aggs)
  }

  def workspaces(resp: SearchResponse): SearchAggregation = {
    SearchAggregation(IndexAggNames.workspace,
      resp.aggregations.nested(IndexAggNames.workspace)
        .result[Terms](IndexAggNames.workspace)
        .buckets.map(bucket => SearchAggregationBucket(bucket.key, bucket.docCount, None)).toList
    )
  }

  def months(resp: SearchResponse): SearchAggregation = {
    val allBuckets = resp.aggregations.histogram(IndexAggNames.createdAt).buckets
    val buckets = allBuckets.collect {
      case HistogramBucket(raw, count, _) if count > 0 =>
        val ts = LocalDateTime.ofInstant(Instant.ofEpochMilli(raw.toLong), ZoneOffset.UTC)
        ts -> count
    }

    val aggs = buckets.groupBy { case(ts, _) => yearsFormat.format(ts) }.map { case(year, values) =>
      val total = values.map(_._2).sum

      SearchAggregationBucket(year, total, Some(values.toList.map { case(start, count) =>
        SearchAggregationBucket(s"$year/${monthsFormat.format(start)}", count, None)
      }))
    }

    SearchAggregation(IndexAggNames.createdAt, aggs.toList)
  }

  def collections(resp: SearchResponse): SearchAggregation = {
    val collections = resp.aggregations.result[Terms](IndexAggNames.collection).buckets.toList
    val ingestions = resp.aggregations.result[Terms](IndexAggNames.ingestion).buckets.toList

    val aggs = collections.map { collection =>
      val subAggs = ingestionsForCollection(collection.key, ingestions)
      SearchAggregationBucket(collection.key, collection.docCount, subAggs)
    }

    SearchAggregation(IndexAggNames.ingestion, aggs)
  }

  private def ingestionsForCollection(collection: String, allIngestions: List[TermBucket]): Option[List[SearchAggregationBucket]] = {
    allIngestions.filter(_.key.startsWith(s"$collection/")) match {
      case Nil =>
        None
      case matchingIngestions =>
        Some(matchingIngestions.map { ingestion =>
          SearchAggregationBucket(ingestion.key, ingestion.docCount)
        })
    }
  }
}
