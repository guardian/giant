package commands

import model.frontend.user.UserRegistration
import services.users.UserManagement
import utils.{Epoch, Logging}
import utils.attempt.Attempt
import utils.auth.{PasswordHashing, PasswordValidator, RequireNotRegistered}
import utils.auth.totp.Totp

import scala.concurrent.ExecutionContext


case class RegisterUser(users: UserManagement,
                        crypto: PasswordHashing,
                        passwordValidator: PasswordValidator,
                        userData: UserRegistration,
                        totp: Totp,
                        time: Epoch,
                        require2FA: Boolean)
                       (implicit ec: ExecutionContext) extends AttemptCommand[Unit] with Logging {
  def process(): Attempt[Unit] = {
    logger.info(s"Attempt to register ${userData.username}")
    for {
      _ <- crypto.verifyUser(users.getUser(userData.username), userData.previousPassword, RequireNotRegistered)
      _ <- passwordValidator.validate(userData.newPassword)
      newHash <- crypto.hash(userData.newPassword)
      secret <- TFACommands.check2FA(require2FA, userData.totpActivation, totp, time)
      _ <- users.registerUser(userData.username, userData.displayName, Some(newHash), secret)
    } yield {
      logger.info(s"Registered ${userData.username}")
      ()
    }
  }
}
