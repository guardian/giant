package model

import play.api.libs.json.{Format, Json}

case class CliIngestion(uri: String, path: Option[String])
object CliIngestion {
  implicit val format: Format[CliIngestion] = Json.format[CliIngestion]
}

case class CliCollection(uri: String, ingestions: List[CliIngestion])
object CliCollection {
  implicit val format: Format[CliCollection] = Json.format[CliCollection]
}
