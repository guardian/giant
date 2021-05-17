package test

import play.api.mvc.Security.AuthenticatedRequest
import play.api.mvc._
import utils.auth
import utils.auth.{AuthActionBuilder, UserIdentityRequest}

import scala.concurrent.Future

class TestAuthActionBuilder(override val controllerComponents: ControllerComponents, reqUser: auth.User) extends AuthActionBuilder {
  override def invokeBlock[A](request: Request[A], block: UserIdentityRequest[A] => Future[Result]) = {
    block(new AuthenticatedRequest(reqUser, request))
  }
}
