package utils.auth.providers

import commands.TFACommands
import model.frontend.user.{NewGenesisUser, PartialUser, UserRegistration}
import model.frontend.TotpActivation
import model.user.{DBUser, NewUser, UserPermissions}
import play.api.libs.json.{JsBoolean, JsNumber, JsValue}
import play.api.mvc.{AnyContent, Request}
import services.users.UserManagement
import services.DatabaseAuthConfig
import utils.attempt._
import utils.auth.{PasswordHashing, PasswordValidator, RequireNotRegistered, RequireRegistered}
import utils.auth.totp.{SecureSecretGenerator, TfaToken, Totp}
import utils.{Epoch, Logging}

import scala.concurrent.ExecutionContext

/**
  * A UserAuthenticator implementation that authenticates a valid user based on credentials stored in the local database
  */
class DatabaseUserProvider(val config: DatabaseAuthConfig, passwordHashing: PasswordHashing, users: UserManagement,
                           totp: Totp, ssg: SecureSecretGenerator, passwordValidator: PasswordValidator)
                          (implicit ec: ExecutionContext)
  extends UserProvider with Logging {

  override def clientConfig: Map[String, JsValue] = Map(
    "require2fa" -> JsBoolean(config.require2FA),
    "minPasswordLength" -> JsNumber(config.minPasswordLength)
  )

  override def authenticate(request: Request[AnyContent], time: Epoch): Attempt[PartialUser] = {
    for {
      formData <- request.body.asFormUrlEncoded.toAttempt(Attempt.Left(ClientFailure("No form data")))
      username <- formData.get("username").flatMap(_.headOption).toAttempt(Attempt.Left(ClientFailure("No username form parameter")))
      password <-formData.get("password").flatMap(_.headOption).toAttempt(Attempt.Left(ClientFailure("No password form parameter")))
      tfaCode = formData.get("tfa").flatMap(_.headOption)
      dbUser <- passwordHashing.verifyUser(users.getUser(username), password, RequireRegistered)
      _ <- totp.checkUser2fa(config.require2FA, dbUser.totpSecret, tfaCode, time)
      _ = logger.info(s"********** User ${dbUser.toString}")
    } yield dbUser.toPartial
  }

  override def generate2faToken(username: String, instance: String): Attempt[TfaToken] = {
    val secret = ssg.createRandomSecret(totp.algorithm).toBase32
    val url = s"otpauth://totp/$username?secret=$secret&issuer=${config.totpIssuer}%20($instance)"
    Attempt.Right(TfaToken(secret, url))
  }

  override def genesisUser(request: JsValue, time: Epoch): Attempt[PartialUser] = {
    for {
      userData <- request.validate[NewGenesisUser].toAttempt
      encryptedPassword <- passwordHashing.hash(userData.password)
      _ <- passwordValidator.validate(userData.password)
      secret <- TFACommands.check2FA(config.require2FA, userData.totpActivation, totp, time)
      // We will immediately register after creating
      user = DBUser(userData.username, None, None, invalidationTime = None, registered = false, totpSecret = None)
      created <- users.createUser(user, UserPermissions.bigBoss)
      registered <- users.registerUser(userData.username, userData.displayName, Some(encryptedPassword), secret)
    } yield registered.toPartial
  }

  override def createUser(username: String, request: JsValue): Attempt[PartialUser] = {
    for {
      wholeUser <- request.validate[NewUser].toAttempt
      _ <- if (username == wholeUser.username) Attempt.Right(()) else Attempt.Left(ClientFailure("Username in URL didn't match that in payload."))
      _ <- passwordValidator.validate(wholeUser.password)
      hash <- passwordHashing.hash(wholeUser.password)
      user <- users.createUser(
          DBUser(wholeUser.username, Some("New User"), Some(hash),
            invalidationTime = None, registered = false, totpSecret = None), UserPermissions.default
        )
    } yield user.toPartial
  }

  override def registerUser(request: JsValue, time: Epoch): Attempt[Unit] = {
    request.validate[UserRegistration].toAttempt.flatMap { userData =>
      logger.info(s"Attempt to register ${userData.username}")
      for {
        _ <- passwordHashing.verifyUser(users.getUser(userData.username), userData.previousPassword, RequireNotRegistered)
        _ <- passwordValidator.validate(userData.newPassword)
        newHash <- passwordHashing.hash(userData.newPassword)
        secret <- TFACommands.check2FA(config.require2FA, userData.totpActivation, totp, time)
        _ <- users.registerUser(userData.username, userData.displayName, Some(newHash), secret)
      } yield {
        logger.info(s"Registered ${userData.username}")
        ()
      }
    }
  }

  override def removeUser(username: String): Attempt[Unit] = {
    users.removeUser(username)
  }

  override def updatePassword(username: String, newPassword: String): Attempt[Unit] = {
    for {
      passwordHash <- passwordHashing.hash(newPassword)
      _ <- passwordValidator.validate(newPassword)
      _ <- users.updateUserPassword(username, passwordHash)
    } yield ()
  }

  override def enrollUser2FA(username: String, totpActivation: TotpActivation, time: Epoch): Attempt[Unit] = {
    for {
      // this is deliberately hardcoded to true, we also pass through a Some, rather than None in this call.
      secret <- TFACommands.check2FA(require2FA = true, Some(totpActivation), totp, time)
      _ <- users.updateTotpSecret(username, secret)
    } yield ()
  }

  override def removeUser2FA(username: String): Attempt[Unit] = {
    for {
      _ <- if (config.require2FA)
             Attempt.Left(SecondFactorRequired("This system requires 2FA so you cannot disable it."))
           else
             Attempt.Right(())
      _ <- users.updateTotpSecret(username, None)
    } yield ()
  }
}