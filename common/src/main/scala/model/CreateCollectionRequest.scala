package model

import play.api.libs.json.Json

case class CreateCollectionRequest(name: String)

object CreateCollectionRequest {
  implicit val createCollectionDataFormat = Json.format[CreateCollectionRequest]
}
