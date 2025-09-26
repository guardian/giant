package services.annotations

import model.Uri
import model.annotations._
import model.frontend.TreeEntry
import services.annotations.Annotations.{AffectedResource, CopyDestination, DeleteItemResult, MoveItemResult}
import utils.attempt.{Attempt, Failure}
import org.neo4j.driver.v1.Value


trait Annotations {
  def setup(): Either[Failure, Unit]

  //def (currentUser: String, workspaceId: String): Attempt[Boolean]
  def getAllWorkspacesMetadata(currentUser: String): Attempt[List[WorkspaceMetadata]]
  def getWorkspaceMetadata(currentUser: String, id: String): Attempt[WorkspaceMetadata]
  def getWorkspaceContents(currentUser: String, id: String): Attempt[TreeEntry[WorkspaceEntry]]
  def insertWorkspace(username: String, id: String, name: String, isPublic: Boolean, tagColor: String): Attempt[Unit]
  def updateWorkspaceName(currentUser: String, id: String, name: String): Attempt[Unit]
  def updateWorkspaceOwner(currentUser: String, owner: String, id: String): Attempt[Unit]
  def updateWorkspaceIsPublic(currentUser: String, id: String, isPublic: Boolean): Attempt[Unit]
  def updateWorkspaceFollowers(currentUser: String, id: String, followers: List[String]): Attempt[Unit]
  def deleteWorkspace(currentUser: String, workspace: String): Attempt[Unit]
  def addFolder(currentUser: String, workspaceId: String, parentFolderId: String, folderName: String): Attempt[String]
  def addResourceToWorkspaceFolder(currentUser: String, fileName: String, uri: Uri, size: Option[Long], mimeType: Option[String], icon: String, workspaceId: String, folderId: String, nodeId: String): Attempt[String]
  def renameWorkspaceItem(currentUser: String, workspaceId: String, itemId: String, name: String): Attempt[Unit]
  def moveWorkspaceItem(currentUser: String, workspaceId: String, itemId: String, newWorkspaceId: Option[String], newParentId: Option[String]): Attempt[MoveItemResult]
  def deleteWorkspaceItem(currentUser: String, workspaceId: String, itemId: String): Attempt[DeleteItemResult]
  def getCopyDestination(user: String, workspaceId: String, newWorkspaceId: Option[String], newParentId: Option[String]): Attempt[CopyDestination]
  def postComment(currentUser: String, uri: Uri, text: String, anchor: Option[CommentAnchor]): Attempt[Unit]
  def getComments(uri: Uri): Attempt[List[Comment]]
  def deleteComment(currentUser: String, commentId: String): Attempt[Unit]
  def getBlobOwners(blobUri: String): Attempt[Set[String]]
}

object Annotations {
  // Resources nodes do not include folders or other workspace only artifacts (but do include blobs, emails etc)
  case class AffectedResource(workspaceNodeId: String, uri: Uri)

  object AffectedResource {
    def fromNeo4jValue(v: Value): Option[AffectedResource] = {
      if (v.get("uri").isNull || v.get("id").isNull) {
        None
      } else {
        Some(AffectedResource(v.get("id").asString(), Uri(v.get("uri").asString())))
      }
    }
  }

  case class DeleteItemResult(resourcesRemoved: List[AffectedResource])
  case class MoveItemResult(resourcesMoved: List[AffectedResource])

  case class CopyDestination(workspaceId: String, parentId: String)
}
