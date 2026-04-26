package model

import play.api.libs.json.{Format, Json}

case class CliIngestion(
  uri: String,
  path: Option[String],
  startTime: Option[String] = None,
  endTime: Option[String] = None,
  languages: Option[List[Language]] = None,
  fixed: Option[Boolean] = None
)
object CliIngestion {
  implicit val format: Format[CliIngestion] = Json.format[CliIngestion]
}

case class CliCollection(uri: String, ingestions: List[CliIngestion], createdBy: Option[String] = None)
object CliCollection {
  implicit val format: Format[CliCollection] = Json.format[CliCollection]
}
