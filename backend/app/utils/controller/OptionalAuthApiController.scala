package utils.controller

import play.api.mvc._
import utils.auth.AuthActionBuilder

import scala.concurrent.ExecutionContext
import scala.language.higherKinds

trait OptionalAuthApiController extends BaseControllerHelpers {
  def controllerComponents: AuthControllerComponents

  val noAuth = new NoAuthApiController {
    val controllerComponents = OptionalAuthApiController.this.controllerComponents
    val failureToResultMapper = OptionalAuthApiController.this.controllerComponents.failureToResultMapper
  }

  val auth = new AuthApiController {
    val controllerComponents = OptionalAuthApiController.this.controllerComponents
  }

  implicit def executionContext: ExecutionContext = controllerComponents.executionContext
}