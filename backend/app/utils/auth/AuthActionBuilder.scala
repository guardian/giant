package utils.auth

import java.time.{Clock, Instant, LocalDateTime, ZoneId, ZoneOffset}

import pdi.jwt.JwtSession._
import play.api.Configuration
import play.api.libs.json.{JsError, JsSuccess}
import play.api.mvc.Security.AuthenticatedRequest
import play.api.mvc._
import services.users.UserManagement
import utils.Logging
import utils.attempt.{Attempt, AuthenticationFailure, Failure}
import utils.controller.FailureToResultMapper

import scala.concurrent.duration.FiniteDuration
import scala.concurrent.{ExecutionContext, Future}

trait AuthActionBuilder extends ActionBuilder[UserIdentityRequest, AnyContent] {
  val controllerComponents: ControllerComponents

  final implicit val executionContext: ExecutionContext = controllerComponents.executionContext
  final val parser: BodyParser[AnyContent] = controllerComponents.parsers.default
}

class DefaultAuthActionBuilder(val controllerComponents: ControllerComponents, failureToResultMapper: FailureToResultMapper,
                               maxLoginAge: FiniteDuration, maxVerificationAge: FiniteDuration, users: UserManagement)(implicit conf: Configuration, clock: Clock)
  extends AuthActionBuilder
  with Logging {

  final def invokeBlock[A](request: Request[A], block: UserIdentityRequest[A] => Future[Result]): Future[Result] =
    invokeBlockWithTime(request, block, System.currentTimeMillis()) map {
      case Right(result) => result
      case Left(err) => failureToResultMapper.failureToResult(err)
    }

  private[auth] def invokeBlockWithTime[A](request: Request[A], block: (UserIdentityRequest[A]) => Future[Result],
                                           now: Long): Future[Either[Failure, Result]] = {
    implicit val implicitReq = request
    val claimData = request.jwtSession.claimData
    val maybeToken = claimData.validate[Token]
    maybeToken match {
      case (JsSuccess(token, _)) if token.loginExpiry > now =>
        val isVerificationExpired = token.verificationExpiry <= now
        for {
          maybeDbUser <- if (isVerificationExpired) getUser(token.user.username).asFuture else Future.successful(Left(AuthenticationFailure("Verification hasn't expired", reportAsFailure = true)))
          result <- block(new AuthenticatedRequest(token.user, request))
        } yield {
          if (isVerificationExpired) {
            maybeDbUser match {
              case Right(user) if user.invalidationTime.exists(token.issuedAt < _) =>
                // The user has logged out
                val msg = s"Authenticated failed because token was issued before database invalidation time"
                logger.warn(token.user.asLogMarker, msg)
                Left(AuthenticationFailure(msg, reportAsFailure = true))
              case Left(failure) =>
                logger.error(token.user.asLogMarker, "Authentication failed because user was not found in DB", failure.toThrowable)
                Left(failure)
              case Right(_) =>
                val verificationExpiry = now + maxVerificationAge.toMillis
                val expiryDateTime = LocalDateTime.ofInstant(
                  Instant.ofEpochMilli(verificationExpiry),
                  ZoneId.systemDefault()
                )
                logger.info(token.user.asLogMarker, s"Authentication succeeded, verification expired but token renewed. New verification expiry: ${expiryDateTime}")
                Right(result
                  .refreshJwtSession
                  .addingToJwtSession(Token.VERIFICATION_EXPIRY_KEY, verificationExpiry)
                  .addingToJwtSession(Token.REFRESHED_AT_KEY, now)
                )
            }
          } else {
            logger.info(token.user.asLogMarker, s"Authentication succeeded")
            Right(result
              .refreshJwtSession
              .addingToJwtSession(Token.REFRESHED_AT_KEY, now)
            )
          }
        }

      case JsSuccess(token, _) => {
        val msg = s"Token is older than $maxLoginAge"
        logger.info(token.user.asLogMarker, msg)
        Future.successful(Left(AuthenticationFailure(msg, reportAsFailure = false)))
      }

      case JsError(errors) => {
        val msg = s"Failed to parse token: $errors"
        logger.warn(msg)
        // This error happens whenever the token is missing,
        // as a result of vulnerability scanners and occasionally developer testing/debugging
        // (e.g. just opening https://giant.pfi.gutools.co.uk/api/search in your browser will fire this alarm).
        // For this reason we don't want to get an alarm.
        Future.successful(Left(AuthenticationFailure(msg, reportAsFailure = false)))
      }
    }
  }

  private def getUser(username: String): Attempt[model.user.DBUser] = users.getUser(username).flatMap { u =>
    if(!u.registered) {
      Attempt.Left(AuthenticationFailure("User not registered", reportAsFailure = true))
    } else {
      Attempt.Right(u)
    }
  }
}
