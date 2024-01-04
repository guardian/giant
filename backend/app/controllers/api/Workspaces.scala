package controllers.api

import commands.DeleteResource
import model.Uri
import model.annotations.{Workspace, WorkspaceEntry, WorkspaceLeaf}
import model.frontend.{TreeEntry, TreeLeaf, TreeNode}
import net.logstash.logback.marker.LogstashMarker
import net.logstash.logback.marker.Markers.append
import play.api.libs.json._
import services.ObjectStorage
import services.manifest.Manifest
import services.observability.PostgresClient
import services.annotations.Annotations
import services.annotations.Annotations.AffectedResource
import services.index.Index
import services.users.UserManagement
import utils.Logging
import utils.attempt._
import utils.auth.{User, UserIdentityRequest}
import utils.controller.{AuthApiController, AuthControllerComponents}

import java.util.UUID

case class CreateWorkspaceData(name: String, isPublic: Boolean, tagColor: String)
object CreateWorkspaceData {
  implicit val format = Json.format[CreateWorkspaceData]
}

case class UpdateWorkspaceFollowers(followers: List[String])
object UpdateWorkspaceFollowers {
  implicit val format = Json.format[UpdateWorkspaceFollowers]
}
case class UpdateWorkspaceIsPublic(isPublic: Boolean)
object UpdateWorkspaceIsPublic {
  implicit val format = Json.format[UpdateWorkspaceIsPublic]
}

case class UpdateWorkspaceName(name: String)
object UpdateWorkspaceName {
  implicit val format = Json.format[UpdateWorkspaceName]
}

case class AddItemParameters(uri: Option[String], size: Option[Long], mimeType: Option[String])
object AddItemParameters {
  implicit val format = Json.format[AddItemParameters]
}

case class AddItemData(name: String, parentId: String, `type`: String, icon: Option[String], parameters: AddItemParameters)
object AddItemData {
  implicit val format = Json.format[AddItemData]
}

case class RenameItemData(name: String)
object RenameItemData {
  implicit val format = Json.format[RenameItemData]
}

case class MoveItemData(newParentId: Option[String], newWorkspaceId: Option[String])
object MoveItemData {
  implicit val format = Json.format[MoveItemData]
}

class Workspaces(override val controllerComponents: AuthControllerComponents, annotation: Annotations, index: Index, manifest: Manifest,
                 users: UserManagement, objectStorage: ObjectStorage, previewStorage: ObjectStorage, postgresClient: PostgresClient) extends AuthApiController with Logging {

  def create = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[CreateWorkspaceData].toAttempt
      id = UUID.randomUUID().toString
      _ = logAction(req.user, id, s"Creating new workspace. ID: $id. Name: ${data.name}. IsPublic: ${data.isPublic}")
      _ <- annotation.insertWorkspace(req.user.username, id, data.name, data.isPublic, data.tagColor)
    } yield {
      Created(id)
    }
  }

  def getAll = ApiAction.attempt { req: UserIdentityRequest[_] =>
    annotation.getAllWorkspacesMetadata(req.user.username)
      .map(workspaces => Ok(Json.toJson(workspaces)))
  }

  private def reprocessBlob(uri: Uri, rerunSuccessful: Boolean, rerunFailed: Boolean): Attempt[Unit] = for {
    _ <- if(rerunFailed) { manifest.rerunFailedExtractorsForBlob(uri) } else { Attempt.Right(()) }
    _ <- if(rerunSuccessful) { manifest.rerunSuccessfulExtractorsForBlob(uri) } else { Attempt.Right(()) }
  } yield {
    ()
  }

  // Execute in series rather than in parallel,
  // to avoid locking issues between successive blobs
  private def reprocessBlobs(blobIds: List[Uri], rerunSuccesful: Boolean, rerunFailed: Boolean): Attempt[Unit] = {
    blobIds match {
      case Nil => Attempt.Right(())
      case blobId :: Nil => reprocessBlob(blobId, rerunSuccesful, rerunFailed)
      case blobId :: tail => reprocessBlob(blobId, rerunSuccesful, rerunFailed).flatMap(_ =>
        reprocessBlobs(tail, rerunSuccesful, rerunFailed)
      )
    }
  }

  // For all blobs that are referenced by nodes in this workspace,
  // re-process those blobs by putting neo4j in a state where
  // first all previously failed extractors will re-run,
  // and then all previously successful extractors will re-run
  def reprocess(workspaceId: String, rerunSuccessfulParam: Option[Boolean], rerunFailedParam: Option[Boolean]) = ApiAction.attempt { req: UserIdentityRequest[_] =>
    val rerunSuccessful = rerunSuccessfulParam.getOrElse(true)
    val rerunFailed = rerunFailedParam.getOrElse(true)

    for {
      contents <- annotation.getWorkspaceContents(req.user.username, workspaceId)
      blobIds = TreeEntry.workspaceTreeToBlobIds(contents)
      _ <- reprocessBlobs(blobIds, rerunSuccessful, rerunFailed)
    } yield {
      Ok(Json.toJson(blobIds))
    }
  }

  def get(workspaceId: String) = ApiAction.attempt { req: UserIdentityRequest[_] =>
    for {
      metadata <- annotation.getWorkspaceMetadata(req.user.username, workspaceId)
      contents <- annotation.getWorkspaceContents(req.user.username, workspaceId)
    } yield {
      Ok(Json.toJson(Workspace.fromMetadataAndRootNode(metadata, contents)))
    }
  }

  def getContents(workspaceId: String) = ApiAction.attempt { req =>
    annotation.getWorkspaceContents(req.user.username, workspaceId)
      .map(workspace => Ok(Json.toJson(workspace)))
  }

  def updateWorkspaceFollowers(workspaceId: String) = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[UpdateWorkspaceFollowers].toAttempt

      _ = logAction(req.user, workspaceId, s"Set workspace followers. Data: $data")
      _ <- annotation.updateWorkspaceFollowers(
        req.user.username,
        workspaceId,
        data.followers
      )
    } yield {
      NoContent
    }
  }


  def updateWorkspaceIsPublic(workspaceId: String) = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[UpdateWorkspaceIsPublic].toAttempt

      _ = logAction(req.user, workspaceId, s"Set workspace isPublic. Data: $data")
      _ <- annotation.updateWorkspaceIsPublic(
        req.user.username,
        workspaceId,
        data.isPublic
      )
    } yield {
      NoContent
    }
  }

  def updateWorkspaceName(workspaceId: String) = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[UpdateWorkspaceName].toAttempt

      _ = logAction(req.user, workspaceId, s"Set workspace name. Data: $data")
      _ <- annotation.updateWorkspaceName(
        req.user.username,
        workspaceId,
        data.name
      )
    } yield {
      NoContent
    }
  }

  def deleteWorkspace(workspaceId: String) = ApiAction.attempt { req: UserIdentityRequest[_] =>
    logAction(req.user, workspaceId, s"Delete workspace. ID: $workspaceId")

    for {
      _ <- annotation.deleteWorkspace(req.user.username, workspaceId)
      _ <- index.deleteWorkspace(workspaceId)
    } yield {
      NoContent
    }
  }

  private def insertItem(username: String, workspaceId: String, workspaceNodeId: String, data: AddItemData): Attempt[String] = {
    if (data.`type` == "folder") {
      annotation.addFolder(username, workspaceId, data.parentId, data.name)
    } else {
      val blobUri = data.parameters.uri.map(Uri(_)).get

      for {
        _ <- annotation.addResourceToWorkspaceFolder(username, data.name, blobUri, data.parameters.size, data.parameters.mimeType, data.icon.get, workspaceId, data.parentId, workspaceNodeId)
        _ <- index.addResourceToWorkspace(blobUri, workspaceId, workspaceNodeId)
      } yield {
        workspaceNodeId
      }
    }
  }

  private def copyTree(workspaceId: String, destinationParentId: String, tree: TreeEntry[WorkspaceEntry], user: String): Attempt[List[String]] = {
    val newId = UUID.randomUUID().toString
    tree match {
      case TreeLeaf(_, name, data, _) =>
        data match {
          case WorkspaceLeaf(_, _, _, _, uri, mimeType, size) =>
            val addItemData = AddItemData(name, destinationParentId, "file", Some("document"), AddItemParameters(Some(uri), size, Some(mimeType)))
            insertItem(user, workspaceId, newId, addItemData).map(i => List(i))
          case _ => Attempt.Left(WorkspaceCopyFailure("Unexpected data type of TreeLeaf"))
        }

      case TreeNode(_, name, _, children) =>
        val addItemData = AddItemData(name, destinationParentId, "folder", None, AddItemParameters(None, None, None))
        val newChildIds = insertItem(user, workspaceId, newId, addItemData).flatMap{_ =>
          Attempt.traverse(children)(child =>  copyTree(workspaceId, newId, child, user))
        }
        newChildIds.map(ids => newId +: ids.flatten )
    }
  }

  def addItemToWorkspace(workspaceId: String) = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[AddItemData].toAttempt
      itemId = UUID.randomUUID().toString

      _ = logAction(req.user, workspaceId, s"Add item to workspace. Node ID: $itemId. Data: $data")
      id <- insertItem(req.user.username, workspaceId, itemId, data)
    } yield {
      Created(Json.obj("id" -> id))
    }
  }

  def renameItem(workspaceId: String, itemId: String) = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[RenameItemData].toAttempt

      _ = logAction(req.user, workspaceId, s"Rename workspace item. Node ID: $itemId. Data: $data")
      _ <- annotation.renameWorkspaceItem(req.user.username, workspaceId, itemId, data.name)
    } yield {
      NoContent
    }
  }

  private def updateIndex(resourceMoved: AffectedResource, oldWorkspaceId: String, newWorkspaceId: Option[String]): Attempt[Unit] = {
    for {
      _ <- index.removeResourceFromWorkspace(
        resourceMoved.uri,
        oldWorkspaceId,
        resourceMoved.workspaceNodeId
      )
      _ <- index.addResourceToWorkspace(
        resourceMoved.uri,
        newWorkspaceId.getOrElse(oldWorkspaceId),
        resourceMoved.workspaceNodeId
      )
    } yield {
      ()
    }
  }

  def moveItem(workspaceId: String, itemId: String) = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[MoveItemData].toAttempt
      _ = logAction(req.user, workspaceId, s"Move workspace item. Node ID: $itemId. Data: $data")

      _ <- if (data.newParentId.contains(itemId)) Attempt.Left(ClientFailure("Cannot move a workspace item to be under itself")) else Attempt.Right(())
      result <- annotation.moveWorkspaceItem(req.user.username, workspaceId, itemId, data.newWorkspaceId, data.newParentId)
      _ <- Attempt.traverse(result.resourcesMoved) { resourceMoved =>
        updateIndex(resourceMoved, workspaceId, data.newWorkspaceId)
      }
    } yield {
      NoContent
    }
  }

  def copyItem(workspaceId: String, itemId: String) = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[MoveItemData].toAttempt
      _ = logAction(req.user, workspaceId, s"Copy workspace item. Node ID: $itemId. Data: $data")

      _ <- if (data.newParentId.contains(itemId)) Attempt.Left(ClientFailure("Cannot copy a workspace item to the same location")) else Attempt.Right(())
      copyDestination <-annotation.getCopyDestination(req.user.username, workspaceId, data.newWorkspaceId, data.newParentId)
      workspaceContents <- annotation.getWorkspaceContents(req.user.username, workspaceId)
      result <- TreeEntry.findNodeById(workspaceContents, itemId)
            .map(entry => copyTree(copyDestination.workspaceId, copyDestination.parentId, entry, req.user.username)).getOrElse(Attempt.Left(ClientFailure("Must supply at least one of newWorkspaceId or newParentId")))
    } yield {
      println(result)
      NoContent
    }
  }


  def removeItem(workspaceId: String, itemId: String) = ApiAction.attempt { req =>
    logAction(req.user, workspaceId, s"Rename workspace item. Node ID: $itemId")

    for {
      result <- annotation.deleteWorkspaceItem(req.user.username, workspaceId, itemId)
      _ <- Attempt.sequence(result.resourcesRemoved.map(r => index.removeResourceFromWorkspace(r.uri, workspaceId, r.workspaceNodeId)))
    } yield {
      NoContent
    }
  }

  def deleteBlob(workspaceId: String, blobUri: String) = ApiAction.attempt { req =>
    annotation.getBlobOwners(blobUri).flatMap { owners =>
      if (owners.size == 1 && owners.head == req.user.username) {
        logAction(req.user, workspaceId, s"Deleting resource from Giant if no children. Resource uri: $blobUri")
        val deleteResource = new DeleteResource(manifest, index, previewStorage, objectStorage, postgresClient)
        deleteResource.deleteBlobCheckChildren(blobUri)
      } else {
        logAction(req.user, workspaceId, s"Can't delete resource due to file ownership conflict. Resource uri: $blobUri")
        Attempt.Left[Unit](DeleteNotAllowed("Failed to delete resource"))
      }
    } map (_ => NoContent)
  }

  private def logAction(user: User, workspaceId: String, message: String) = {
    val markers: LogstashMarker = user.asLogMarker.and(append("workspaceId", workspaceId))
    logger.info(markers, message)
  }
}
