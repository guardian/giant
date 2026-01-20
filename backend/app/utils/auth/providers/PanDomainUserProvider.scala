package utils.auth.providers

import com.gu.pandomainauth.PanDomain
import com.gu.pandomainauth.model._
import com.gu.pandomainauth.service.CryptoConf.Verification
import model.frontend.TotpActivation
import model.frontend.user.PartialUser
import model.user.{DBUser, UserPermissions}
import play.api.libs.json.{JsString, JsValue}
import play.api.mvc.{AnyContent, Request}
import services.users.UserManagement
import services.{MetricsService, PandaAuthConfig}
import utils.attempt.AttemptAwait._
import utils.attempt._
import utils.auth.totp.TfaToken
import utils.{Epoch, Logging}

import scala.concurrent.ExecutionContext
import scala.concurrent.duration._

/**
  * A UserAuthenticator implementation that authenticates a valid user based on the presence of a pan-domain cookie
  */
class PanDomainUserProvider(val config: PandaAuthConfig, verificationProvider: () => Verification, users: UserManagement, metricsService: MetricsService)(implicit ec: ExecutionContext)
  extends UserProvider with Logging {

  /** The client needs to know where to redirect the user so they can pick up a pan domain cookie **/
  override def clientConfig: Map[String, JsValue] = Map(
    "loginUrl" -> JsString(config.loginUrl)
  )

  override def authenticate(request: Request[AnyContent], time: Epoch): Attempt[PartialUser] = {

    def validateUser(user: AuthenticatedUser): Boolean = {
      val passesMultifactor = if (config.require2FA) user.multiFactor else true
      val dbUser = users.getUser(user.user.email.toLowerCase()).awaitEither(10.seconds)
      dbUser.isRight && passesMultifactor
    }

    val maybeCookie = request.cookies.get(config.cookieName)

    maybeCookie match {
      case Some(cookieData) =>
        val status = PanDomain.authStatus(cookieData.value, verificationProvider(), validateUser, "giant", cacheValidation = false, forceExpiry = false)
        status match {
          case Authenticated(authedUser) =>
            val downcasedAuthedUser = authedUser.copy(user = authedUser.user.copy(email = authedUser.user.email.toLowerCase()))
            for {
              user <- users.getUser(downcasedAuthedUser.user.email)
              displayName = s"${downcasedAuthedUser.user.firstName} ${downcasedAuthedUser.user.lastName}"
              _ <- if (user.registered)
                Attempt.Right(user)
              else {
                users.registerUser(user.username, displayName, None, None)
              }
            } yield {
              metricsService.recordUsageEvent(user.username)
              PartialUser(user.username, user.displayName.getOrElse(displayName))
            }
          case NotAuthorized(authedUser) => Attempt.Left(PanDomainCookieInvalid(s"User ${authedUser.user.email} is not authorised to use this system.", reportAsFailure = true))
          case InvalidCookie(integrityFailure) => Attempt.Left(PanDomainCookieInvalid(s"Pan domain cookie invalid: $integrityFailure", reportAsFailure = true))
          case Expired(authedUser) => Attempt.Left(PanDomainCookieInvalid(s"User ${authedUser.user.email} panda cookie has expired.", reportAsFailure = false))
          case other =>
            logger.warn(s"Pan domain auth failure: $other")
            Attempt.Left(AuthenticationFailure(s"Pan domain auth failed: $other", reportAsFailure = true))
        }
      case None => Attempt.Left(PanDomainCookieInvalid(s"No pan domain cookie available in request with name ${config.cookieName}", reportAsFailure = false))
    }
  }

  /** create an all powerful initial user **/
  override def genesisUser(request: JsValue, time: Epoch): Attempt[PartialUser] = {
    for {
      email <- (request \ "username").validate[String].toAttempt
      user = DBUser(email, None, None, None, registered = false, None)
      createdUser <- users.createUser(user, UserPermissions.bigBoss)
    } yield createdUser.toPartial
  }

  /** create a new user account */
  override def createUser(username: String, request: JsValue): Attempt[PartialUser] = {
    val user = DBUser(username, None, None, None, registered = false, None)
    for {
      // we mark this user as not registered so we can cache the display name when we see them
      createdUser <- users.createUser(user, UserPermissions.default)
    } yield createdUser.toPartial
  }

  /** delete and disable a user account **/
  override def removeUser(username: String): Attempt[Unit] = {
    users.removeUser(username)
  }

  /** None of these make sense for a pan domain authed user so we return a failure **/
  override def updatePassword(username: String, newPassword: String): Attempt[Unit] = unsupportedOperation
  override def generate2faToken(username: String, instance: String): Attempt[TfaToken] = unsupportedOperation
  override def registerUser(request: JsValue, time: Epoch): Attempt[Unit] = unsupportedOperation
  override def enrollUser2FA(username: String, totpActivation: TotpActivation, time: Epoch): Attempt[Unit] = unsupportedOperation
  override def removeUser2FA(username: String): Attempt[Unit] = unsupportedOperation

  def unsupportedOperation[T] = Attempt.Left[T](UnsupportedOperationFailure("This authentication provider is federated and doesn't support this operation."))

}
