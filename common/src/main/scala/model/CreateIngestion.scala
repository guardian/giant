package model

import play.api.libs.json.{Format, Json}

// Fixed and default are optional for compatibility with older builds of the cli but default safe to fixed=true, default=false
case class CreateIngestionRequest(path: Option[String], name: Option[String], languages: List[String], fixed: Option[Boolean], default: Option[Boolean])

object CreateIngestionRequest {
  implicit val format: Format[CreateIngestionRequest] = Json.format[CreateIngestionRequest]
}

case class CreateIngestionResponse(uri: String, bucket: String, region: String, endpoint: Option[String])

object CreateIngestionResponse {
  implicit val format: Format[CreateIngestionResponse] = Json.format[CreateIngestionResponse]
}
