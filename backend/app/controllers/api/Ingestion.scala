package controllers.api

import model.user.UserPermission.CanPerformAdminOperations
import play.api.mvc._
import services.S3IngestStorage
import utils.attempt._
import utils.controller.{AuthApiController, AuthControllerComponents}

class Ingestion(override val controllerComponents: AuthControllerComponents, storage: S3IngestStorage)
  extends AuthApiController {

  def retryDeadLetterFiles(): Action[AnyContent] = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      Attempt.fromEither(storage.retryDeadLetters() match {
        case Right(_) => Right(Ok("Sent all dead letter files for reingest"))
        case Left(failure) => Left(failure)
      })
    }
  }

}
