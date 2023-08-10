package services.observability

import play.api.libs.json.{Format, Json}
import services.observability.ExtractorType.ExtractorType
import model.manifest.Blob

object IngestionEvent extends Enumeration {
  type IngestionEvent = Value

  val HashComplete, BlobCopy, ManifestExists, MimeTypeDetected, OcrComplete, ZipExtractionSuccess, PreviouslyProcessed = Value

  implicit val format: Format[IngestionEvent] = Json.formatEnum(this)
}

object ExtractorType extends Enumeration {
  type ExtractorType = Value

  val Zip, Rar, Olm, Msg, DocumentBody = Value

  implicit val format: Format[ExtractorType] = Json.formatEnum(this)
}

case class IngestionError(message: String, stackTrace: Option[String] = None)

object IngestionError {
  implicit val format = Json.format[IngestionError]
}

case class Details(errors: Option[List[IngestionError]] = None, extractors: Option[List[ExtractorType]] = None, blob: Option[Blob] = None)

object Details {
  implicit val detailsFormat = Json.format[Details]
}
