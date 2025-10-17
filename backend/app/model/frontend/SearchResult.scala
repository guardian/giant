package model.frontend

import model.Recipient
import play.api.libs.json._

case class SearchResult(
  uri: String,
  highlights: Seq[Highlight],
  fieldWithMostHighlights: Option[String],
  flag: Option[String],
  createdAt: Option[Long],
  details: ResultDetails
)

sealed trait ResultDetails
case class DocumentResultDetails(mimeTypes: Seq[String], fileUris: Seq[String], fileSize: Option[Long]) extends ResultDetails
case class EmailResultDetails(from: Recipient, subject: String, attachmentCount: Int) extends ResultDetails

object ResultDetails {
  val docFormat: OFormat[DocumentResultDetails] = Json.format[DocumentResultDetails]
  val emailFormat: OFormat[EmailResultDetails] = Json.format[EmailResultDetails]

  implicit val format: Format[ResultDetails] = new Format[ResultDetails] {
    override def reads(json: JsValue): JsResult[ResultDetails] = {
      (json \ "_type").get match {
        case JsString("document") => docFormat.reads(json)
        case JsString("email") => emailFormat.reads(json)
        case other => JsError(s"Unexpected type in search result $other")
      }
    }

    override def writes(details: ResultDetails): JsValue = {
      details match {
        case r: EmailResultDetails => emailFormat.writes(r) + ("_type", JsString("email"))
        case r: DocumentResultDetails => docFormat.writes(r) + ("_type", JsString("document"))
        case other => throw new UnsupportedOperationException(s"Unable to serialize result details of type ${other.getClass.toString}")
      }
    }
  }
}

object SearchResult {
  implicit val format: Format[SearchResult] = Json.format[SearchResult]
}

case class SearchAggregationBucket(key: String, count: Long, buckets: Option[List[SearchAggregationBucket]] = None)

object SearchAggregationBucket {
  implicit val searchAggregationBucketFormat: Format[SearchAggregationBucket] = Json.format[SearchAggregationBucket]
}

case class SearchAggregation(key: String, buckets: List[SearchAggregationBucket])

object SearchAggregation {
  implicit val searchAggregationFormat: Format[SearchAggregation] = Json.format[SearchAggregation]
}

case class SearchResults(hits: Long, took: Long, page: Long, pageSize: Long, results: List[SearchResult], aggs: Set[SearchAggregation]) extends Paging[SearchResult]

object SearchResults {
  implicit val searchResultsFormat: Format[SearchResults] = Json.format[SearchResults]

  val empty: SearchResults = SearchResults(
    hits = 0,
    took = 0,
    page = 1,
    pageSize = 0,
    results = List.empty,
    aggs = Set.empty
  )
}
