package utils.auth

import utils.attempt.{Attempt, ClientFailure}

class PasswordValidator(minPasswordLength: Int) {
  def validate(password: String): Attempt[String] = {
    if (password.length >= minPasswordLength) {
      Attempt.Right(password)
    } else {
      Attempt.Left(ClientFailure(s"Provided password too short, must be at least $minPasswordLength characters"))
    }
  }
}
