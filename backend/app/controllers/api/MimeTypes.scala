package controllers.api

import model.user.UserPermission.CanPerformAdminOperations
import play.api.libs.json.Json
import services.manifest.Manifest
import utils.MimeDetails
import utils.attempt.Attempt
import utils.controller.{AuthApiController, AuthControllerComponents}

class MimeTypes(val controllerComponents: AuthControllerComponents, manifest: Manifest) extends AuthApiController {
  def getDetails = ApiAction {
    Right(Ok(Json.toJson(MimeDetails.displayMap)))
  }

  def getCoverage = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      Attempt.fromEither(manifest.getMimeTypesCoverage).map(coverage => Ok(Json.toJson(coverage)))
    }
  }
}

