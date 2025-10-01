package test

import model.Uri
import model.annotations.{Comment, CommentAnchor, WorkspaceEntry, WorkspaceMetadata}
import model.frontend.TreeEntry
import services.annotations.Annotations
import services.annotations.Annotations.CopyDestination
import utils.attempt.{Attempt, Failure, UnsupportedOperationFailure}

class TestAnnotations(usersToWorkspaces: Map[String, List[String]] = Map.empty) extends Annotations {
  override def getAllWorkspacesMetadata(currentUser: String): Attempt[List[WorkspaceMetadata]] = {
    val workspaces = usersToWorkspaces.getOrElse(currentUser, List.empty).map { id =>
      WorkspaceMetadata(id, id, isPublic = false, tagColor="", creator=null, owner=null, followers=List.empty)
    }

    Attempt.Right(workspaces)
  }

  override def setup(): Either[Failure, Unit] = Right(())
  override def insertWorkspace(username: String, id: String, name: String, isPublic: Boolean, tagColor: String): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def updateWorkspaceFollowers(currentUser: String, id: String, followers: List[String]): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def updateWorkspaceIsPublic(currentUser: String, id: String, isPublic: Boolean): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def updateWorkspaceName(currentUser: String, id: String, name: String): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def updateWorkspaceOwner(currentUser: String, id: String, owner: String,): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def deleteWorkspace(currentUser: String, workspace: String): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def addFolder(currentUser: String, workspaceId: String, parentFolderId: String, folderName: String): Attempt[String] = Attempt.Left(UnsupportedOperationFailure(""))
  override def addResourceToWorkspaceFolder(currentUser: String, fileName: String, uri: Uri, size: Option[Long], mimeType: Option[String], icon: String, workspaceId: String, folderId: String, nodeId: String): Attempt[String] = Attempt.Left(UnsupportedOperationFailure(""))
  override def renameWorkspaceItem(currentUser: String, workspaceId: String, itemId: String, name: String): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def moveWorkspaceItem(currentUser: String, workspaceId: String, itemId: String, newWorkspaceId: Option[String], newParentId: Option[String]): Attempt[Annotations.MoveItemResult] = Attempt.Left(UnsupportedOperationFailure(""))
  override def deleteWorkspaceItem(currentUser: String, workspaceId: String, itemId: String): Attempt[Annotations.DeleteItemResult] = Attempt.Left(UnsupportedOperationFailure(""))
  override def getCopyDestination(user: String, workspaceId: String, newWorkspaceId: Option[String], newParentId: Option[String]): Attempt[CopyDestination] = Attempt.Left(UnsupportedOperationFailure(""))
  override def postComment(currentUser: String, uri: Uri, text: String, anchor: Option[CommentAnchor]): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def getComments(uri: Uri): Attempt[List[Comment]] = Attempt.Left(UnsupportedOperationFailure(""))
  override def deleteComment(currentUser: String, commentId: String): Attempt[Unit] = Attempt.Left(UnsupportedOperationFailure(""))
  override def getWorkspaceContents(currentUser: String, id: String): Attempt[TreeEntry[WorkspaceEntry]] = Attempt.Left(UnsupportedOperationFailure(""))
  override def getWorkspaceMetadata(currentUser: String, id: String): Attempt[WorkspaceMetadata] = Attempt.Left(UnsupportedOperationFailure(""))
  override def getBlobOwners(blobUri: String): Attempt[Set[String]] = Attempt.Left(UnsupportedOperationFailure(""))
}
