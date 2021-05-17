package model.manifest

import model.Uri
import org.neo4j.driver.v1.Value
import play.api.libs.json._

case class Blob(uri: Uri, size: Long, mimeType: Set[MimeType])

object Blob {
  implicit val blobFormat = Json.format[Blob]

  def fromNeo4jValue(blob: Value, mimeTypes: Seq[Value]): Blob = {
    Blob(Uri(blob.get("uri").asString()),
      blob.get("size").asLong(), mimeTypes.map(MimeType.fromNeo4jValue).toSet)
  }
}
