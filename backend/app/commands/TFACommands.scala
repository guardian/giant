package commands

import model.frontend.TotpActivation
import utils.attempt.{Attempt, ClientFailure, SecondFactorRequired}
import utils.auth.totp.{Base32Secret, Secret, Totp}
import utils.Epoch

import scala.concurrent.ExecutionContext

object TFACommands {
  def check2FA(require2FA: Boolean, totpActivation: Option[TotpActivation], totp: Totp, time: Epoch)
              (implicit ec: ExecutionContext): Attempt[Option[Secret]] = {
    for {
      _ <- if (require2FA && totpActivation.isEmpty)
        Attempt.Left(SecondFactorRequired("2FA enrollment is required"))
      else
        Attempt.Right(())

      maybeSecret <- Attempt.traverseOption(totpActivation) { activation =>
        val secret = Base32Secret(activation.secret)
        for {
          _ <- totp.checkCodeFatal(secret, activation.code, time, ClientFailure("Sample 2FA code wasn't valid, check the time on your device"))
        } yield secret
      }
    } yield maybeSecret
  }
}
