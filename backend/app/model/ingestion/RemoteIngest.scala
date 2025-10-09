package model.ingestion

import model.frontend.user.PartialUser
import org.joda.time.DateTime
import play.api.libs.json.Json
import services.observability.JodaReadWrites
import services.{IngestStorage, MediaDownloadConfig}
import utils.Logging

object RemoteIngestStatus extends Enumeration {
  type RemoteIngestStatus = Value
  val Queued, Ingesting, Completed, Failed  = Value
}

case class RemoteIngest(
  id: String,
  title: String,
  status: RemoteIngestStatus.RemoteIngestStatus,
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
  implicit val remoteIngestWrites = Json.writes[RemoteIngest]

  def ingestionKey(createdAt: DateTime, id: String): Key = (createdAt.getMillis, java.util.UUID.fromString(id))
}
