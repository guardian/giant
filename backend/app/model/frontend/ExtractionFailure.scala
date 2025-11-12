package model.frontend

import play.api.libs.json.{Format, Json, Reads}

case class ExtractionFailureSummary(extractorName: String, stackTrace: String, numberOfBlobs: Long)

object ExtractionFailureSummary {
  implicit val format: Format[ExtractionFailureSummary] = Json.format[ExtractionFailureSummary]
}

case class ResourcesForExtractionFailureRequest(extractorName: String, stackTrace: String, page: Option[Long], pageSize: Option[Long])
object ResourcesForExtractionFailureRequest {
  implicit val reads: Reads[ResourcesForExtractionFailureRequest] = Json.reads[ResourcesForExtractionFailureRequest]
}

case class ResourcesForExtractionFailure(hits: Long, page: Long, pageSize: Long, results: List[BasicResource]) extends Paging[Resource]
object ResourcesForExtractionFailure {
  implicit val format: Format[ResourcesForExtractionFailure] = Json.format[ResourcesForExtractionFailure]
}

case class ExtractionFailures(results: List[ExtractionFailureSummary])

object ExtractionFailures {
  implicit val format: Format[ExtractionFailures] = Json.format[ExtractionFailures]
}
