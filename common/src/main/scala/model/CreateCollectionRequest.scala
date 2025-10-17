package model

import play.api.libs.json.{Json, Format}

case class CreateCollectionRequest(name: String)

object CreateCollectionRequest {
  implicit val createCollectionDataFormat: Format[CreateCollectionRequest] = Json.format[CreateCollectionRequest]
}
