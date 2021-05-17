package services.index

import model.Uri
import model.ingestion.WorkspaceItemContext
import model.manifest.MimeType

case class IngestionData(createdAt: Option[Long], lastModifiedAt: Option[Long], mimeTypes: Set[MimeType], uris: Set[Uri],
                         parentBlobs: List[Uri], ingestion: String, workspace: Option[WorkspaceItemContext])
