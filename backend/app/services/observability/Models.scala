package services.observability

import play.api.libs.json.{Format, Json}
import services.observability.ExtractorType.ExtractorType

object IngestionEvent extends Enumeration {
  type IngestionEvent = Value

  val HashComplete, MimeTypeDetected, OcrComplete, ZipExtractionSuccess, PreviouslyProcessed = Value

  implicit val format: Format[IngestionEvent] = Json.formatEnum(this)
}

object ExtractorType extends Enumeration {
  type ExtractorType = Value

  val Zip, Rar, Olm, Msg, DocumentBody = Value

  implicit val format: Format[ExtractorType] = Json.formatEnum(this)
}

case class IngestionError(message: String, stackTrace: String)

object IngestionError {
  implicit val format = Json.format[IngestionError]
}

case class Details(errors: List[IngestionError], extractors: List[ExtractorType], fileSize: Int, relativePath: String)

object Details {
  implicit val detailsFormat = Json.format[Details]
}
