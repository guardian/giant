package controllers.api

import commands.DeleteResource
import model.Uri
import model.user.UserPermission.CanPerformAdminOperations
import play.api.libs.json.Json
import play.api.mvc.{Action, AnyContent, Request, Result}
import services.ObjectStorage
import services.index.Index
import services.manifest.Manifest
import utils.Logging
import utils.attempt.{Attempt, DeleteFailure}
import utils.controller.{AuthApiController, AuthControllerComponents, FailureToResultMapper}


class Blobs(override val controllerComponents: AuthControllerComponents, manifest: Manifest, index: Index,
            objectStorage: ObjectStorage, previewStorage: ObjectStorage)
  extends AuthApiController with Logging {

  def param(name: String, req: Request[AnyContent]): Option[String] = req.queryString.get(name).flatMap(_.headOption)

  def getBlobs = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      (param("collection", req), param("ingestion", req)) match {
        case (Some(collection), Some(ingestion)) =>
          val uri = Uri(collection).chain(ingestion)
          val size = param("size", req).map(_.toInt).getOrElse(500)

          for {
            _ <- manifest.getIngestion(uri)
            blobs <- index.getBlobs(collection, ingestion, size)
          } yield {
            Ok(Json.obj(
              "blobs" -> blobs
            ))
          }

        case _ =>
          Attempt.Right(BadRequest("Missing collection or ingestion query parameter"))
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


  def delete(id: String, deleteFolders: Boolean, checkChildren: Boolean): Action[AnyContent] = ApiAction.attempt { req =>
    import scala.language.existentials
    val deleteResource = new DeleteResource(manifest, index, previewStorage, objectStorage)
    checkPermission(CanPerformAdminOperations, req) {
      val result = if (checkChildren) deleteResource.deleteBlobCheckChildren(id, deleteFolders)
      else deleteResource.deleteBlob(id, deleteFolders)
      result.map(_ => NoContent)
    }
  }
}
