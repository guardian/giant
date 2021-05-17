package controllers.api

import model.frontend.TotpActivation
import model.frontend.user.PartialUser
import model.manifest.UserWithCollections
import model.user.UserPermission.CanPerformAdminOperations
import model.user.{UserPermission, UserPermissions}
import play.api.libs.json._
import utils._
import utils.attempt._
import utils.auth.UserIdentityRequest
import utils.auth.providers.UserProvider
import utils.controller.{OptionalAuthApiController, AuthControllerComponents}

class Users(override val controllerComponents: AuthControllerComponents, userProvider: UserProvider)
  extends OptionalAuthApiController with Logging {

  def listUsers = auth.ApiAction.attempt { req =>
    auth.checkPermission(CanPerformAdminOperations, req) {
      listUsersAsAdmin().map { usersWithCollections =>
        Ok(Json.obj("users" -> Json.toJson(usersWithCollections)))
      }
    }.recoverWith {
      case MissingPermissionFailure(_) =>
        listUsersAsPunter().map { partialUsers =>
          Ok(Json.obj("users" -> Json.toJson(partialUsers)))
        }
    }
  }

  def getMyPermissions = auth.ApiAction.attempt { req: UserIdentityRequest[_] =>
    for {
      permissions <- controllerComponents.users.getPermissions(req.user.username)
    } yield Ok(Json.toJson(permissions))
  }

  // Create a new user, requires auth and CanManagerUsers permission
  def createUser(username: String) = auth.ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    for {
      user <- auth.checkPermission(CanPerformAdminOperations, req) {
        userProvider.createUser(username, req.body)
      }
    } yield Ok(Json.toJson(user))
  }

  // Register the skeleton of a user
  def registerUser(username: String) = noAuth.ApiAction.attempt(parse.json) { request =>
    for {
      _ <- userProvider.registerUser(request.body, Epoch.now)
    } yield NoContent
  }

  def updateUserFullname(username: String) = auth.ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    for {
      displayName <- (req.body \ "displayName").validate[String].toAttempt

      _ <- auth.checkPermission(CanPerformAdminOperations, req) {
        controllerComponents.users.updateUserDisplayName(username, displayName)
      }
    } yield NoContent
  }

  def updateUserPassword(username: String) = auth.ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    for {
      newPassword <- (req.body \ "password").validate[String].toAttempt
      _ <- auth.checkPermission(CanPerformAdminOperations, req) {
        userProvider.updatePassword(username, newPassword)
      }
    } yield NoContent
  }

  def setPermissions(username: String) = auth.ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    for {
      granted <- (req.body \ "permissions" \ "granted").validate[Set[UserPermission]].toAttempt
      _ <- auth.checkPermission(CanPerformAdminOperations, req) {
        if(username == req.user.username && !granted.contains(CanPerformAdminOperations)) {
          // Avoid confusion by revoking your own permission to grant permissions
          Attempt.Left(IllegalStateFailure(s"Cannot remove CanPerformAdminOperations from yourself"))
        } else {
          controllerComponents.users.setPermissions(username, UserPermissions(granted))
        }
      }
    } yield NoContent
  }

  def enrollUser2FA(username: String) = auth.ApiAction.attempt(parse.json) { req: UserIdentityRequest[JsValue] =>
    val time = Epoch.now
    for {
      totpActivation <- (req.body \ "totpActivation").validate[TotpActivation].toAttempt
      _ <- auth.checkPermission(CanPerformAdminOperations, req) {
        userProvider.enrollUser2FA(username, totpActivation, time)
      }
    } yield NoContent
  }

  def removeUser2FA(username: String) = auth.ApiAction.attempt { req: UserIdentityRequest[_] =>
    for {
      _ <- auth.checkPermission(CanPerformAdminOperations, req) {
        userProvider.removeUser2FA(username)
      }
    } yield NoContent
  }

  def removeUser(username: String) = auth.ApiAction.attempt { request: UserIdentityRequest[_] =>
    for {
      _ <- if (username == request.user.username) Attempt.Left(ClientFailure("Cannot delete own user account")) else Attempt.Right(())
      _ <- auth.checkPermission(CanPerformAdminOperations, request) {
        userProvider.removeUser(username)
      }
    } yield NoContent
  }

  private def listUsersAsPunter(): Attempt[List[PartialUser]] = {
    controllerComponents.users.listUsers().map { userList =>
      userList.map { case(dbUser, _) => dbUser.toPartial }
    }
  }

  private def listUsersAsAdmin(): Attempt[List[UserWithCollections]] = {
    controllerComponents.users.listUsers().flatMap { userList =>
      Attempt.sequence(userList.map { case (user, collections) =>
        controllerComponents.users.getPermissions(user.username).map { permissions =>
          val partialUser = user.toPartial
          UserWithCollections(partialUser.username, partialUser.displayName, collections.map(_.uri.value), permissions)
        }
      })
    }
  }
}
