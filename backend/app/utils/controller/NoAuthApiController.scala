package utils.controller

import play.api.mvc.{ActionBuilder, AnyContent, Request}
import utils.attempt.Failure

trait NoAuthApiController extends PfiApiController[Request] {
  final override def actionBuilder: ActionBuilder[Request, AnyContent] = controllerComponents.actionBuilder
  final override def failureToResult(r: Request[_], error: Failure) =
    FailureToResultMapper.failureToResult(error)
}
