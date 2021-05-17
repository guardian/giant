package utils.controller

import model.user.UserPermission
import play.api.mvc.{ActionBuilder, AnyContent, Result}
import utils.attempt.{Attempt, MissingPermissionFailure}
import utils.attempt.Failure
import utils.auth.UserIdentityRequest

trait AuthApiController extends PfiApiController[UserIdentityRequest] {
  def controllerComponents: AuthControllerComponents

  final override def actionBuilder: ActionBuilder[UserIdentityRequest, AnyContent] = controllerComponents.authActionBuilder
  final override def failureToResult(r: UserIdentityRequest[_], err: Failure): Result = controllerComponents.failureToResultMapper.failureToResult(err, Some(r.user))

  def checkPermission[T](permission: UserPermission, req: UserIdentityRequest[_])(fn: => Attempt[T]): Attempt[T] = {
    val username = req.user.username

    controllerComponents.users.getPermissions(username).flatMap { p =>
      if(p.hasPermission(permission)) {
        fn
      } else {
        Attempt.Left[T](MissingPermissionFailure(s"$username is missing the ${permission.toString} permission"))
      }
    }
  }
}
