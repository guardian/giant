package utils.auth

import java.security.SecureRandom

import model.user.BCryptPassword
import org.bouncycastle.crypto.DataLengthException
import org.bouncycastle.crypto.generators.OpenBSDBCrypt
import utils.attempt.{Attempt, LoginFailure, UserDoesNotExistFailure}
import model.user.DBUser
import utils.Logging

import scala.concurrent.ExecutionContext

object PasswordHashing {
  val DEFAULT_COST_FACTOR = 14  // this seems reasonable for now (1-2 seconds to run)
}

sealed trait RegistrationCheck
case object RequireRegistered extends RegistrationCheck
case object RequireNotRegistered extends RegistrationCheck

class PasswordHashing(costFactor: Int = PasswordHashing.DEFAULT_COST_FACTOR) extends Logging {
  if (costFactor < PasswordHashing.DEFAULT_COST_FACTOR) {
    logger.warn("The password hashing cost factor has been reduced from the default, this should only be done for tests.")
  }

  private val BCRYPT_SALT_LENGTH = 16

  private val secureRandom = new SecureRandom()

  private def genSalt(): Array[Byte] = {
    val salt = new Array[Byte](BCRYPT_SALT_LENGTH)
    secureRandom.nextBytes(salt)
    salt
  }

  def hash(password: String): Attempt[BCryptPassword] = {
    val salt = genSalt()
    Attempt.catchNonFatal {
      val hash = OpenBSDBCrypt.generate(password.toCharArray, salt, costFactor)
      BCryptPassword(hash)
    } {
      case dle: DataLengthException => LoginFailure(dle.getMessage)
      case iae: IllegalArgumentException => LoginFailure(iae.getMessage)
    }
  }

  def verify(hash: BCryptPassword, password: String): Attempt[Boolean] =
    Attempt.catchNonFatal {
      OpenBSDBCrypt.checkPassword(hash.hash, password.toCharArray)
    } {
      case dle: DataLengthException => LoginFailure(dle.getMessage)
      case iae: IllegalArgumentException => LoginFailure(iae.getMessage)
    }

  /*
    Unusually this takes maybeUser as an attempt - this is deliberate as is allows us to always hash the password supplied
    regardless of whether the user exists in the DB to prevent leaking of user existence.
   */
  def verifyUser(maybeUser: Attempt[DBUser], password: String, registrationCheck: RegistrationCheck)(implicit ec: ExecutionContext): Attempt[DBUser] =
    maybeUser.flatMap { user =>
      user.password match {
        case Some(userPassword) =>
          verify(userPassword, password).flatMap {
            case true =>
              (registrationCheck, user.registered) match {
                case (RequireRegistered, false) =>
                  Attempt.Left[DBUser](LoginFailure("User requires registration"))
                case (RequireNotRegistered, true) =>
                  Attempt.Left[DBUser](LoginFailure("User already registered"))
                case _ =>
                  Attempt.Right(user)
              }
            case false =>
              Attempt.Left[DBUser](LoginFailure("Incorrect password"))
          }
        // the user has no password set so any provided password is wrong
        case None => Attempt.Left[DBUser](LoginFailure("Incorrect password"))
      }
    }.recoverWith {
      case err: UserDoesNotExistFailure =>
        // Hash the password anyway so the client does not perceive a difference in how long the login takes
        hash(password).flatMap(_ => Attempt.Left[DBUser](err))
    }
}
