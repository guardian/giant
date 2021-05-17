package model.index

import play.api.libs.json.{Format, Json}

case class IndexedBlob(uri: String, ingestion: Set[String])
object IndexedBlob {
  implicit val format: Format[IndexedBlob] = Json.format[IndexedBlob]
}
