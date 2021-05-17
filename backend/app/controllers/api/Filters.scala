package controllers.api

import commands._
import play.api.libs.json._
import services.annotations.Annotations
import services.manifest.Manifest
import utils.controller.{AuthApiController, AuthControllerComponents}

class Filters(val controllerComponents: AuthControllerComponents, manifest: Manifest, annotations: Annotations)
  extends AuthApiController {

  def getFilters = ApiAction.attempt { req =>
    GetFilters(manifest, controllerComponents.users, annotations, req.user.username).process().map(docs => Ok(Json.toJson(docs)))
  }
}
