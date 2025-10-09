package model.ingestion

import model.frontend.user.PartialUser
import org.joda.time.DateTime
import play.api.libs.json.Json
import services.observability.JodaReadWrites
import utils.Logging

case class RemoteIngest(
  id: String,
  title: String,
  status: String,
  workspaceId: String,
  parentFolderId: String,
  collection: String,
  ingestion: String,
  createdAt: DateTime,
  url: String,
  addedBy: PartialUser,
  blobUri: Option[String] = None
) {

  val ingestionKey: Key = RemoteIngest.ingestionKey(createdAt, id)
  // val timeoutAt = createdAt.plus(Duration.standardHours(4)) TODO implement timeouts
}

object RemoteIngest extends Logging {
  implicit val dateWrites = JodaReadWrites.dateWrites
  implicit val dateReads = JodaReadWrites.dateReads
  implicit val remoteIngestFormat = Json.format[RemoteIngest]

  def ingestionKey(createdAt: DateTime, id: String): Key = (createdAt.getMillis, java.util.UUID.fromString(id))
}
