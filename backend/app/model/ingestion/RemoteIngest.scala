package model.ingestion

import org.joda.time.DateTime
import play.api.libs.json.Json
import services.observability.JodaReadWrites

case class RemoteIngest(
                         id: String,
                         title: String,
                         status: String,
                         workspaceId: String,
                         workspaceNodeId: String,
                         parentFolderId: String,
                         collection: String,
                         ingestion: String,
                         timeoutAt: DateTime,
                         url: String,
                         userEmail: String)
case object RemoteIngest {
  implicit val dateWrites = JodaReadWrites.dateWrites
  implicit val dateReads = JodaReadWrites.dateReads
  implicit val remoteIngestFormat = Json.format[RemoteIngest]
}

