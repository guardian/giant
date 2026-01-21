package controllers.api

import software.amazon.awssdk.services.sns.SnsClient
import commands.DeleteResource
import model.Uri
import model.annotations.{ProcessingStage, Workspace, WorkspaceEntry, WorkspaceLeaf}
import model.frontend.{TreeEntry, TreeLeaf, TreeNode}
import model.ingestion.{RemoteIngest, RemoteIngestStatus}
import net.logstash.logback.marker.LogstashMarker
import net.logstash.logback.marker.Markers.append
import org.joda.time.DateTime
import play.api.libs.json._
import play.api.mvc.Action
import services.{IngestStorage, ObjectStorage, RemoteIngestConfig}
import services.manifest.Manifest
import services.observability.PostgresClient
import services.annotations.Annotations
import services.annotations.Annotations.AffectedResource
import services.index.Index
import services.ingestion.RemoteIngestStore
import services.users.UserManagement
import utils.{Logging, Stopwatch}
import utils.attempt._
import utils.auth.{User, UserIdentityRequest}
import utils.controller.{AuthApiController, AuthControllerComponents}

import java.util.UUID

case class CreateWorkspaceData(name: String, isPublic: Boolean, tagColor: String)
object CreateWorkspaceData {
  implicit val format: Format[CreateWorkspaceData] = Json.format[CreateWorkspaceData]
}

case class UpdateWorkspaceFollowers(followers: List[String])
object UpdateWorkspaceFollowers {
  implicit val format: Format[UpdateWorkspaceFollowers] = Json.format[UpdateWorkspaceFollowers]
}
case class UpdateWorkspaceIsPublic(isPublic: Boolean)
object UpdateWorkspaceIsPublic {
  implicit val format: Format[UpdateWorkspaceIsPublic] = Json.format[UpdateWorkspaceIsPublic]
}

case class UpdateWorkspaceName(name: String)
object UpdateWorkspaceName {
  implicit val format: Format[UpdateWorkspaceName] = Json.format[UpdateWorkspaceName]
}

case class UpdateWorkspaceOwner(owner: String)
object UpdateWorkspaceOwner {
  implicit val format: Format[UpdateWorkspaceOwner] = Json.format[UpdateWorkspaceOwner]
}

case class AddItemParameters(uri: Option[String], size: Option[Long], mimeType: Option[String])
object AddItemParameters {
  implicit val format: Format[AddItemParameters] = Json.format[AddItemParameters]
}

case class AddRemoteUrlData(url: String, title: String, parentFolderId: String)
object AddRemoteUrlData {
  implicit val format: Format[AddRemoteUrlData] = Json.format[AddRemoteUrlData]
}

case class AddItemData(name: String, parentId: String, `type`: String, icon: Option[String], parameters: AddItemParameters)
object AddItemData {
  implicit val format: Format[AddItemData] = Json.format[AddItemData]
}

case class RenameItemData(name: String)
object RenameItemData {
  implicit val format: Format[RenameItemData] = Json.format[RenameItemData]
}

case class MoveCopyDestination(newParentId: Option[String], newWorkspaceId: Option[String])
object MoveCopyDestination {
  implicit val format: Format[MoveCopyDestination] = Json.format[MoveCopyDestination]
}

class Workspaces(
                  override val controllerComponents: AuthControllerComponents,
                  annotation: Annotations,
                  index: Index,
                  manifest: Manifest,
                  users: UserManagement,
                  objectStorage: ObjectStorage,
                  previewStorage: ObjectStorage,
                  postgresClient: PostgresClient,
                  remoteIngestStore: RemoteIngestStore,
                  remoteIngestStorage: IngestStorage,
                  remoteIngestConfig: RemoteIngestConfig,
                  snsClient: SnsClient
) extends AuthApiController with Logging {

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
    _ <- if(rerunFailed) {
      manifest.rerunFailedExtractorsForBlob(uri)
      manifest.rerunFailedExternalExtractorsForBlob(uri)
    } else { Attempt.Right(()) }
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
    val requestId = UUID.randomUUID().toString
    val trackingId = s"$workspaceId-$requestId"
    val response = for {
      metadata <- Stopwatch.measureAttempt(annotation.getWorkspaceMetadata(req.user.username, workspaceId)).track("getWorkspaceMetadata", trackingId)
      relevantRemoteJobs <- Stopwatch.measureAttempt(remoteIngestStore.getRelevantRemoteIngestJobs(workspaceId)).track("relevantRemoteJobs", trackingId)
      contents <- Stopwatch.measureAttempt(annotation.getWorkspaceContents(req.user.username, workspaceId, relevantRemoteJobs)).track("getWorkspaceContents", trackingId)
    } yield {
      val json: JsValue = Stopwatch.measureAndLog({Json.toJson(Workspace.fromMetadataAndRootNode(metadata, contents))}, "json write", trackingId  )
      Ok(json)
    }
    Stopwatch.measureAttempt(response).track(s"get workspace ${workspaceId}", trackingId)
    response
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

  def updateWorkspaceOwner(workspaceId: String) = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[UpdateWorkspaceOwner].toAttempt

      _ = logAction(req.user, workspaceId, s"Updating workspace owner. Data: $data")
      _ <- annotation.updateWorkspaceOwner(
        req.user.username,
        workspaceId,
        data.owner
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
        // a TreeLeaf won't have any children, so just insert the item at the destination location, and return it's new ID
        data match {
          case WorkspaceLeaf(_, _, _, _, _, uri, mimeType, size) =>
            val addItemData = AddItemData(name, destinationParentId, "file", Some("document"), AddItemParameters(Some(uri), size, Some(mimeType)))
            insertItem(user, workspaceId, newId, addItemData).map(i => List(i))
          case _ => Attempt.Left(WorkspaceCopyFailure("Unexpected data type of TreeLeaf"))
        }

      case TreeNode(_, name, _, children) =>
        // TreeNodes are folders. We need to create the folder in the new destination, and then recurse on every child item

        // create the folder in the destination location
        val addItemData = AddItemData(name, destinationParentId, "folder", None, AddItemParameters(None, None, None))
        val newFolderIdAttempt = insertItem(user, workspaceId, newId, addItemData)
        // for every child, recurse, setting the newly created folder as the destination
        val newChildIds = newFolderIdAttempt.flatMap{ newFolderId =>
          Attempt.traverse(children)(child => copyTree(workspaceId, newFolderId, child, user))
        }
        // return ids of all child nodes combined with the id of the new folder
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

  def getRelevantRemoteJobs(workspaceId: String) = ApiAction.attempt { req =>
    for {
      jobs <- remoteIngestStore.getRelevantRemoteIngestJobs(workspaceId)
    } yield {
      Ok(Json.toJson(jobs))
    }
  }

  def archiveRemoteIngestTask(workspaceId: String, taskId: String) = ApiAction.attempt {
    for {
      _ <- remoteIngestStore.archiveRemoteIngestTask(taskId)
    } yield {
      NoContent
    }
  }

  def addRemoteUrlToWorkspace(workspaceId: String): Action[JsValue] = ApiAction.attempt(parse.json) { req =>
    for {
      data <- req.body.validate[AddRemoteUrlData].toAttempt
      itemId = UUID.randomUUID().toString
      mediaDownloadId = UUID.randomUUID().toString
      webpageSnapshotId = UUID.randomUUID().toString
      _ = logAction(req.user, workspaceId, s"Add remote url to workspace. Node ID: $itemId. Data: $data")
      defaultCollectionUriForUser <- users.getDefaultCollectionUriForUser(req.user.username)
      createdAt = DateTime.now
      id <- remoteIngestStore.insertRemoteIngest(
        id = itemId,
        workspaceId = workspaceId,
        collection = defaultCollectionUriForUser,
        title = data.title,
        url = data.url,
        parentFolderId = data.parentFolderId,
        createdAt = createdAt,
        username = req.user.username,
        mediaDownloadId = mediaDownloadId,
        webpageSnapshotId = webpageSnapshotId
      )
      _ <- RemoteIngest.sendRemoteIngestJob(id, data.url, createdAt, mediaDownloadId, webpageSnapshotId, remoteIngestConfig, snsClient, remoteIngestStorage).toAttempt(msg => SQSSendMessageFailure(msg))
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
      data <- req.body.validate[MoveCopyDestination].toAttempt
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
      data <- req.body.validate[MoveCopyDestination].toAttempt
      _ = logAction(req.user, workspaceId, s"Copy workspace item. Node ID: $itemId. Data: $data")

      _ <- if (data.newParentId.contains(itemId)) Attempt.Left(ClientFailure("Cannot copy a workspace item to the same location")) else Attempt.Right(())
      copyDestination <-annotation.getCopyDestination(req.user.username, workspaceId, data.newWorkspaceId, data.newParentId)
      workspaceContents <- annotation.getWorkspaceContents(req.user.username, workspaceId)
      _ <- TreeEntry.findNodeById(workspaceContents, itemId)
            .map(entry => copyTree(copyDestination.workspaceId, copyDestination.parentId, entry, req.user.username)).getOrElse(Attempt.Left(ClientFailure("Must supply at least one of newWorkspaceId or newParentId")))
    } yield {
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
