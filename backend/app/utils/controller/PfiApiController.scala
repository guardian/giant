package utils.controller

import play.api.mvc._
import utils.attempt.{Attempt, Failure}
import utils.auth.{UserIdentityRequest, User}

import scala.concurrent.{ExecutionContext, Future}
import scala.language.higherKinds
import play.api.mvc.Security.AuthenticatedRequest

trait PfiApiController[R[_]] extends BaseControllerHelpers {
  def actionBuilder: ActionBuilder[R, AnyContent]
  def failureToResult(r: R[_], err: Failure): Result

  final implicit def executionContext: ExecutionContext = controllerComponents.executionContext

  object ApiAction {
    def apply(thing: => Either[Failure, Result]): Action[AnyContent] =
      apply(_ => thing)
    def apply(thing: R[AnyContent] => Either[Failure, Result]): Action[AnyContent] =
      apply(actionBuilder.parser)(thing)
    def apply[A](bodyParser: BodyParser[A])(thing: R[A] => Either[Failure, Result]): Action[A] =
      async(bodyParser)(thing andThen Future.successful)
    def async(thing: => Future[Either[Failure, Result]]): Action[AnyContent] =
      async(actionBuilder.parser)(_ => thing)
    def async(thing: R[AnyContent] => Future[Either[Failure, Result]]): Action[AnyContent] =
      async(actionBuilder.parser)(thing)
    def async[A](bodyParser: BodyParser[A])(thing: R[A] => Future[Either[Failure, Result]]): Action[A] =
      actionBuilder.async(bodyParser) { request =>
        thing(request).map {
          case Right(result) => result
          case Left(err) => failureToResult(request, err)
        }(defaultExecutionContext)
      }

    def attempt(thing: => Attempt[Result]): Action[AnyContent] =
      attempt(actionBuilder.parser)(_ => thing)
    def attempt(thing: R[AnyContent] => Attempt[Result]): Action[AnyContent] =
      attempt(actionBuilder.parser)(thing)
    def attempt[A](bodyParser: BodyParser[A])(thing: R[A] => Attempt[Result]): Action[A] =
      async(bodyParser)(thing andThen (att => att.asFuture(defaultExecutionContext)))
  }
}
