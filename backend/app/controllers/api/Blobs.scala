package controllers.api

import commands.DeleteResource
import model.Uri
import model.user.UserPermission.CanPerformAdminOperations
import net.logstash.logback.marker.LogstashMarker
import play.api.libs.json.Json
import play.api.mvc.{Action, AnyContent, Request, Result}
import services.ObjectStorage
import services.index.Index
import services.manifest.Manifest
import services.observability.PostgresClient
import services.previewing.PreviewService
import utils.Logging
import utils.attempt.{Attempt, DeleteFailure}
import utils.auth.User
import utils.controller.{AuthApiController, AuthControllerComponents, FailureToResultMapper}


class Blobs(override val controllerComponents: AuthControllerComponents, manifest: Manifest, index: Index,
            objectStorage: ObjectStorage, previewStorage: ObjectStorage, postgresClient: PostgresClient)
  extends AuthApiController with Logging {

  def param(name: String, req: Request[AnyContent]): Option[String] = req.queryString.get(name).flatMap(_.headOption)

  // inMultiple means only return blobs that are also in other collections/ingestions than those supplied.
  // For instance:
  //   ?collection=c&inMultiple=true
  //   returns blobs in collection c and at least one other collection
  //
  //   ?collection=c&ingestion=i&inMultiple=true
  //   returns blobs in ingestion c/i and at least one other ingestion
  def getBlobs(collection: Option[String], ingestion: Option[String], inMultiple: Option[Boolean], size: Option[Int]) = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      (collection, ingestion, inMultiple) match {
        case (Some(collection), maybeIngestion, maybeInMultiple) =>
          index.getBlobs(collection, maybeIngestion, size.getOrElse(500), maybeInMultiple.getOrElse(false)).map(blobs =>
            Ok(Json.obj("blobs" -> blobs))
          )

        case _ =>
          Attempt.Right(BadRequest("Missing collection query parameter"))
      }
    }
  }

  def countBlobs(collection: Option[String], ingestion: Option[String], inMultiple: Option[Boolean]) = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      (collection, ingestion, inMultiple) match {
        case (Some(collection), maybeIngestion, maybeInMultiple) =>
          index.countBlobs(collection, maybeIngestion, maybeInMultiple.getOrElse(false)).map(count =>
            Ok(Json.obj("count" -> count))
          )

        case _ =>
          Attempt.Right(BadRequest("Missing collection query parameter"))
      }
    }
  }

  def reprocess(id: String, rerunSuccessfulParam: Option[Boolean], rerunFailedParam: Option[Boolean]) = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      val uri = Uri(id)

      def rerunFailedIfRequested() = {
        if(rerunFailedParam.getOrElse(true)) {
          logger.info(s"Reprocessing failed extractors for blob ${id}")
          manifest.rerunFailedExtractorsForBlob(uri)
        } else {
          Attempt.Right(())
        }
      }

      def rerunSuccessfulIfRequested() = {
        if(rerunSuccessfulParam.getOrElse(true)) {
          logger.info(s"Reprocessing successful extractors for blob ${id}")
          manifest.rerunSuccessfulExtractorsForBlob(uri)
        } else {
          Attempt.Right(())
        }
      }

      for {
        _ <- rerunFailedIfRequested()
        _ <- rerunSuccessfulIfRequested()
      } yield {
        NoContent
      }
    }
  }


  def delete(id: String, checkChildren: Boolean, isAdminDelete: Boolean): Action[AnyContent] = ApiAction.attempt { req =>
    import scala.language.existentials
    val deleteResource = new DeleteResource(manifest, index, previewStorage, objectStorage)
    if (isAdminDelete) {
      checkPermission(CanPerformAdminOperations, req) {
        val result = if (checkChildren) deleteResource.deleteBlobCheckChildren(id)
        else deleteResource.deleteBlob(id)
        result.map(_ => NoContent)
      }
    } else {
      deleteForNoneAdmin(req.user, id).map(_ => NoContent)
    }
  }

  private def deleteForNoneAdmin(user: User, blobUri: String): Attempt[Unit] = {
    manifest.getCollectionsForBlob(blobUri).flatMap { collections =>
      // Here we check either of 2 followings:
      // if there's only 1 collection holding the blob and if the requesting user has view access to the collection
      // OR if the requesting user is the only creator of the blob
      if ((collections.size == 1 && collections.head._2.contains(user.username)) || collections.forall(c => c._1.createdBy == Some(user.username))) {
        logAction(user, s"Deleting resource from Giant if no children. Resource uri: $blobUri")
        val deleteResource = new DeleteResource(manifest, index, previewStorage, objectStorage)
        deleteResource.deleteBlobCheckChildren(blobUri)
      } else {
        logAction(user, s"Can't delete resource due to file ownership conflict. Resource uri: $blobUri")
        Attempt.Left[Unit](DeleteFailure("Failed to delete resource"))
      }
    }
  }

  private def logAction(user: User, message: String) = {
    val markers: LogstashMarker = user.asLogMarker
    logger.info(markers, message)
  }

}
