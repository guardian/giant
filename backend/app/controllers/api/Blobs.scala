package controllers.api

import commands.DeleteResource
import model.Uri
import model.user.UserPermission.CanPerformAdminOperations
import play.api.libs.json.Json
import play.api.mvc.{Action, AnyContent, Request, Result}
import services.ObjectStorage
import services.index.Index
import services.manifest.Manifest
import services.previewing.PreviewService
import utils.Logging
import utils.attempt.{Attempt, DeleteFailure}
import utils.controller.{AuthApiController, AuthControllerComponents, FailureToResultMapper}


class Blobs(override val controllerComponents: AuthControllerComponents, manifest: Manifest, index: Index,
            objectStorage: ObjectStorage, previewStorage: ObjectStorage, previewService: PreviewService)
  extends AuthApiController with Logging {

  def param(name: String, req: Request[AnyContent]): Option[String] = req.queryString.get(name).flatMap(_.headOption)

  def getBlobs = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      (param("collection", req), param("ingestion", req)) match {
        case (Some(collection), maybeIngestion) =>
          val size = param("size", req).map(_.toInt)

          index.getBlobs(collection, maybeIngestion, size).map(blobs =>
            Ok(Json.obj("blobs" -> blobs))
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
