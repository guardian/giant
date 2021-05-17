package model.manifest

import model._
import model.ingestion.WorkspaceItemContext

case class WorkItem(blob: Blob, parentBlobs: List[Uri], extractorName: String, ingestion: String, languages: List[Language], workspace: Option[WorkspaceItemContext])
