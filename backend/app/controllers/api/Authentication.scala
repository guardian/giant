package controllers.api

import akka.NotUsed
import akka.actor.ActorSystem
import akka.stream.{Materializer, OverflowStrategy}
import akka.stream.scaladsl.{Source, SourceQueueWithComplete}
import model.Uri
import model.index.FrontendPage
import pdi.jwt.JwtSession._
import pdi.jwt.JwtTime
import play.api.libs.json.Json
import play.api.mvc.{AnyContent, ControllerComponents, Request}
import services.Config
import services.users.UserManagement
import utils.{Epoch, Logging}
import utils.attempt._
import utils.auth._
import utils.auth.providers.UserProvider
import utils.controller.{AuthControllerComponents, OptionalAuthApiController}

import java.time.Clock
import play.api.Configuration

import scala.concurrent.ExecutionContext

class Authentication(override val controllerComponents: AuthControllerComponents, userAuthenticator: UserProvider, users: UserManagement, config: Config)(implicit conf: Configuration, clock: Clock)
  extends OptionalAuthApiController with Logging {

  def healthcheck() = noAuth.ApiAction {
    Right(Ok("Ok"))
  }

  def liveClock() = noAuth.ApiAction {
    import java.time.ZonedDateTime
    import java.time.format.DateTimeFormatter
    import javax.inject.Singleton
    import akka.stream.scaladsl.Source
    import play.api.http.ContentTypes
    import play.api.libs.EventSource
    import play.api.mvc._

    import scala.concurrent.duration._

    val df: DateTimeFormatter = DateTimeFormatter.ofPattern("HH mm ss")
    val tickSource = Source.tick(0.millis, 100.millis, "TICK")
    val source = tickSource.map { (tick) =>
      df.format(ZonedDateTime.now())
    }
    Right(Ok.chunked(source via EventSource.flow).as(ContentTypes.EVENT_STREAM))
  }

  def token() = noAuth.ApiAction.attempt { implicit request:Request[AnyContent] =>
    val time = Epoch.now
    for {
      user <- userAuthenticator.authenticate(request, time)
      permissions <- users.getPermissions(user.username)
    } yield {
      val issuedAt = JwtTime.now
      val loginExpiry = issuedAt + config.auth.timeouts.maxLoginAge.toMillis
      val verificationExpiry = issuedAt + config.auth.timeouts.maxVerificationAge.toMillis

      logger.info(s"User ${user.username} logged in. Login Expiry: $loginExpiry. Verification Expiry: $verificationExpiry")

      NoContent
        .addingToJwtSession(Token.USER_KEY, Json.toJson(user))
        .addingToJwtSession(Token.ISSUED_AT_KEY, issuedAt)
        .addingToJwtSession(Token.REFRESHED_AT_KEY, issuedAt)
        .addingToJwtSession(Token.LOGIN_EXPIRY_KEY, loginExpiry)
        .addingToJwtSession(Token.VERIFICATION_EXPIRY_KEY, verificationExpiry)
        .addingToJwtSession(Token.PERMISSIONS, Json.toJson(permissions))
    }
  }

  def invalidateExistingTokens() = auth.ApiAction.attempt { request: UserIdentityRequest[AnyContent] =>
    for {
      _ <- users.updateInvalidatedTime(request.user.username, System.currentTimeMillis())
    } yield {
      logger.info(s"User ${request.user.username} logged out")

      NoContent
    }
  }

  def generate2faToken(username: String) = noAuth.ApiAction.attempt { request: Request[AnyContent] =>
    userAuthenticator.generate2faToken(username, config.app.label.getOrElse(request.host))
      .map { token =>
        Ok(Json.obj("secret" -> token.secret, "url" -> token.url))
      }
  }

  def keepalive() = auth.ApiAction.attempt {
    Attempt.Right(NoContent)
  }
}
