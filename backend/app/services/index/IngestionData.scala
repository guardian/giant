package services.index

import model.Uri
import model.ingestion.WorkspaceItemContext
import model.manifest.MimeType
import play.api.libs.json.{Format, Json}

case class IngestionData(createdAt: Option[Long], lastModifiedAt: Option[Long], mimeTypes: Set[MimeType], uris: Set[Uri],
                         parentBlobs: List[Uri], ingestion: String, workspace: Option[WorkspaceItemContext])

object IngestionData {
  implicit val format: Format[IngestionData] = Json.format[IngestionData]
}
