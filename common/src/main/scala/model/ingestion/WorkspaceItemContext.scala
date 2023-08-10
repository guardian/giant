package model.ingestion

import play.api.libs.json.Json

// Passed via TODOs in neo4j
/**
  * Information about where in a workspace a file has been uploaded to. Passed via TODOs in neo4j.
  * @param workspaceId
  * @param workspaceNodeId
  * @param blobAddedToWorkspace the blob that was added. May be a parent of the current blob being processed.
  */
case class WorkspaceItemContext(workspaceId: String, workspaceNodeId: String, blobAddedToWorkspace: String)

object WorkspaceItemContext {
  implicit val format = Json.format[WorkspaceItemContext]
  def fromUpload(blobUri: String, workspace: WorkspaceItemUploadContext): WorkspaceItemContext = {
    WorkspaceItemContext(workspace.workspaceId, workspace.workspaceNodeId, blobUri)
  }
}

// Passed from the client in an upload request
case class WorkspaceItemUploadContext(workspaceId: String, workspaceNodeId: String, workspaceParentNodeId: String, workspaceName: String)