package controllers.api

import java.net.URLDecoder
import java.nio.file.Paths
import java.util.UUID
import commands._
import model.ingestion.WorkspaceItemUploadContext
import model.manifest.CollectionWithUsers
import model.user.UserPermission.CanPerformAdminOperations
import model.{CreateCollectionRequest, CreateIngestionRequest, CreateIngestionResponse, Uri, VerifyRequest}
import play.api.libs.json._
import play.api.mvc._
import services.{FingerprintServices, S3Config}
import services.annotations.Annotations
import services.index.{Index, Pages}
import services.ingestion.IngestionServices
import services.manifest.Manifest
import services.users.UserManagement
import utils.IngestionVerification
import utils.attempt._
import utils.auth.UserIdentityRequest
import utils.controller.{AuthApiController, AuthControllerComponents}

class Collections(override val controllerComponents: AuthControllerComponents, manifest: Manifest,
                  users: UserManagement, index: Index, s3Config: S3Config, esEvents: services.events.Events,
                  pages: Pages, ingestionServices: IngestionServices, annotations: Annotations)
  extends AuthApiController {

  def newCollection() = ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    for {
      data <- req.body.validate[CreateCollectionRequest].toAttempt
      collection <- CreateCollection(data.name, req.user.username, manifest).process()
      _ <- users.addUserCollection(req.user.username, data.name)
    } yield {
      Created(Json.toJson(collection))
    }
  }

  def listCollections() = ApiAction.attempt { req =>
    for {
      allCollections <- manifest.getCollections
      userCollections <- users.getAllCollectionUrisAndUsernames()
      isAdmin <- users.hasPermission(req.user.username, CanPerformAdminOperations)
    } yield {
      val allCollectionsWithUsers = allCollections.map { collection =>
        val users = userCollections.getOrElse(collection.uri.value, Set.empty)
        CollectionWithUsers(collection, users)
      }

      val collections = if(isAdmin) {
        allCollectionsWithUsers
      } else {
        allCollectionsWithUsers.filter(_.users.contains(req.user.username))
      }

      Ok(Json.toJson(collections))
    }
  }

  def getCollection(collection: Uri) = ApiAction.attempt { req =>
    (for {
      isAdmin <- users.hasPermission(req.user.username, CanPerformAdminOperations)
      canSeeCollection <- users.canSeeCollection(req.user.username, collection)
    } yield {
      (isAdmin, canSeeCollection)
    }).flatMap {
      case (true, _) | (false, true) =>
        for {
          collection <- manifest.getCollection(collection)
          users <- users.getUsersForCollection(collection.uri.value)
        } yield {
          Ok(Json.toJson(CollectionWithUsers(collection, users)))
        }

      case (false, false) =>
        // GitHub-style error - a thing exists but we can't see it so tell the user it doesn't exist
        Attempt.Left(NotFoundFailure(s"$collection does not exist"))

    }
  }

  def newIngestion(collection: Uri) = ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    users.canSeeCollection(req.user.username, collection).flatMap {
      case true =>
        for {
          data <- req.body.validate[CreateIngestionRequest].toAttempt
          command = CreateIngestion(data, collection, manifest, index, pages)

          id <- command.process()
        } yield {
          val response = CreateIngestionResponse(
            uri = id.value,
            bucket = s3Config.buckets.ingestion,
            region = s3Config.region,
            endpoint = s3Config.endpoint
          )

          Ok(Json.toJson(response))
        }

      case false =>
        // GitHub-style error - a thing exists but we can't see it so tell the user it doesn't exist
        Attempt.Left(NotFoundFailure(s"$collection does not exist"))
    }
  }

  def uploadIngestionFile(collection: String, ingestion: String) = ApiAction.attempt(parse.temporaryFile) { req =>
    users.canSeeCollection(req.user.username, Uri(collection)).flatMap {
      case true =>
        (req.headers.get(CONTENT_LOCATION), req.headers.get("X-PFI-Upload-Id")) match {
          case (Some(rawOriginalPath), Some(uploadId)) =>
            val originalPath = URLDecoder.decode(rawOriginalPath, "UTF-8")
            val lastModifiedTime = req.headers.get("X-PFI-Last-Modified")
            val maybeWorkspaceContext = buildWorkspaceItemContext(req.headers)
            val temporaryFilePath = req.body.path
            val fingerprint = FingerprintServices.createFingerprintFromFile(temporaryFilePath.toFile)

            val childrenWithSameUri = manifest.getWorkspaceChildrenWithUri(maybeWorkspaceContext, fingerprint)

            childrenWithSameUri.flatMap { blobs =>
              if (blobs.length > 0) {
                println(s"number of existing children is ${blobs.length} ")
                val uri = Uri(fingerprint)

                for {
                  _ <- manifest.rerunFailedExtractorsForBlob(uri)
                  _ <- manifest.rerunSuccessfulExtractorsForBlob(uri)
                } yield {
                  Created(Json.toJson(blobs.head))
                }
              } else {
                println("No children found")
                new IngestFile(
                  Uri(collection),
                  Uri(collection).chain(ingestion),
                  uploadId,
                  workspace = maybeWorkspaceContext,
                  req.user.username,
                  temporaryFilePath = req.body.path,
                  originalPath = Paths.get(originalPath),
                  lastModifiedTime,
                  manifest, esEvents, ingestionServices, annotations
                ).process().map { result =>
                  Created(Json.toJson(result))
                }
              }
            }

          case _ =>
            Attempt.Right(BadRequest(s"Missing $CONTENT_LOCATION or X-PFI-Upload-Id header"))
        }

      case false =>
        // GitHub-style error - a thing exists but we can't see it so tell the user it doesn't exist
        Attempt.Left(NotFoundFailure(s"$collection does not exist"))
    }
  }

  def setUserCollections(username: String) = ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    checkPermission(CanPerformAdminOperations, req) {
      for {
        currentCollections <- req.body.validate[List[String]].toAttempt
        existingCollections <- users.getVisibleCollectionUrisForUser(username)
        // TODO MRB: this should be a single transactional operation in the database
        _ <- Attempt.sequence(existingCollections.map { coll => users.removeUserCollection(username, coll) })
        _ <- Attempt.sequence(currentCollections.map(collection => users.addUserCollection(username, collection)))
      } yield {
        NoContent
      }
    }
  }

  def verifyFiles(collection: String, ingestion: String) = ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    checkPermission(CanPerformAdminOperations, req) {
      for {
        request <- req.body.validate[VerifyRequest].toAttempt
        files = VerifyIngestion.relativise(collection, ingestion, request.files)
          .take(IngestionVerification.BATCH_SIZE) // just in case the list is big enough to cause query plan issues

        response <- new VerifyIngestion(files, manifest).process().toAttempt
      } yield {
        Ok(Json.toJson(response))
      }
    }
  }

  def deleteIngestion(collection: String, ingestion: String) = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      val uri = Uri(collection).chain(ingestion)

      for {
        // Confirm this thing is actually an ingestion first,
        // since the delete operation operates on any :Resource
        _ <- manifest.getIngestion(uri)
        _ <- manifest.deleteResourceAndDescendants(uri)
      } yield {
        NoContent
      }
    }
  }

  def deleteCollection(collection: Uri) = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      for {
        // Confirm this thing is actually a collection first,
        // since the delete operation operates on any :Resource
        _ <- manifest.getCollection(collection)
        _ <- manifest.deleteResourceAndDescendants(collection)
      } yield {
        NoContent
      }
    }
  }

  private def buildWorkspaceItemContext(headers: Headers): Option[WorkspaceItemUploadContext] = for {
    workspaceId <- headers.get("X-PFI-Workspace-Id")
    workspaceName <- headers.get("X-PFI-Workspace-Name")
    workspaceParentNodeId <- headers.get("X-PFI-Workspace-Parent-Node-Id")

    workspaceNodeId = UUID.randomUUID().toString
  } yield {
    WorkspaceItemUploadContext(workspaceId, workspaceNodeId, workspaceParentNodeId, workspaceName)
  }
}
