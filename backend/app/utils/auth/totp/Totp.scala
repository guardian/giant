package utils.auth.totp

import java.math.BigInteger
import java.security.GeneralSecurityException

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.apache.commons.codec.binary.Base32
import utils.attempt.{Attempt, AuthenticationFailure, ClientFailure, Failure, MisconfiguredAccount, SecondFactorRequired}
import utils.Epoch

import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.language.postfixOps

object Totp {
  val windowSize: FiniteDuration = 30 seconds

  def getTimeWindow(time: Epoch): Long = time.seconds / windowSize.toSeconds

  // Base32 is the most common representation format to tokens (e.g. Google Authenticator)
  val b32 = new Base32()
  def base32ToBytes(base32: String): Vector[Byte] = b32.decode(base32).toVector
  def bytesToBase32(bytes: Vector[Byte]): String = b32.encodeAsString(bytes.toArray)

  // Return all the REAL bytes, not the "first" synthetic byte
  def hexStrToBytes(hex: String): Vector[Byte] = new BigInteger("10" + hex, 16).toByteArray.tail.toVector

  // Pad out string to the left with the given character
  def padLeft(in: String, length: Int, pad: Char): String = s"${pad.toString * (length - in.length)}$in"

  /**
    * Get an instance of TOTP appropriate for google authenticator. This is set to produce six digit codes and use
    * the HmacSHA1 algorithm.
    * @param windowErrorTolerance Specifies how much error to tolerate (defaults to 2 which allows a minute either side)
    * @return
    */
  def googleAuthenticatorInstance(windowErrorTolerance: Int = 2) = new Totp(6, Algorithm.HmacSHA1, windowErrorTolerance)
}

/**
  * TOTP code generator / checker as specified by RFC 6238 (https://tools.ietf.org/html/rfc6238)
  * @param codeLength The number of digits to use in a OTP
  * @param algorithm The algorithm to use. One of SHA1, SHA256 or SHA512 as specified in the RFC.
  * @param windowErrorTolerance Specifies how much error to tolerate (i.e. how many tokens to generate / check on
  *                             each side of the current token). This can be used to allow for a small amount of client
  *                             clock drift.
  */
class Totp(val codeLength: Int, val algorithm: Algorithm, windowErrorTolerance: Int) {

  /**
    * Check 2fa for a provided user. This returns a Right if authentication is valid or Left if not.
    */
  def checkUser2fa(require2FA: Boolean, totpSecret: Option[Secret], maybeCode: Option[String], time: Epoch)
                  (implicit ec: ExecutionContext): Attempt[Boolean] = {
    (require2FA, totpSecret, maybeCode) match {
      case (true, None, _)               => Attempt.Left(MisconfiguredAccount("2FA is required but user is not enrolled"))
      case (_, Some(_), None)            => Attempt.Left(SecondFactorRequired("2FA code required"))
      case (false, None, _)              => Attempt.Right(false)
      case (_, Some(secret), Some(code)) => checkCodeFatal(secret, code, time, SecondFactorRequired("2FA code not valid"))
    }
  }

  def checkCodeFatal(secret: Secret, code: String, time: Epoch, failure: Failure)(implicit ec: ExecutionContext): Attempt[Boolean] = {
    checkCode(secret, code, time).flatMap { isValid =>
      if (isValid) Attempt.Right(isValid) else Attempt.Left(failure)
    }
  }

  /**
    * Actually check a TOTP code against a provided secret
    */
  def checkCode(secret: Secret, code: String, time: Epoch)(implicit ec: ExecutionContext): Attempt[Boolean] = {
    generateList(secret, time).map(_.contains(code))
  }

  /**
    * Generate a list of TOTP codes based on the epoch provided and windowErrorTolerance codes either side.
    */
  def generateList(secret: Secret, time: Epoch)(implicit ec: ExecutionContext): Attempt[List[String]] = {
    val window = Totp.getTimeWindow(time)
    Attempt.traverse((window - windowErrorTolerance).to(window + windowErrorTolerance).toList)(generate(secret, _))
  }

  /**
    * Generate a single TOTP code for this precise epoch
    */
  def generate(secret: Secret, timeWindow: Long)(implicit ec: ExecutionContext): Attempt[String] = {
    if (!isSecretValid(secret)) {
      Attempt.Left(AuthenticationFailure(s"Provided secret is not the correct length for $algorithm (${secret.data.length} instead of ${algorithm.secretLength}", reportAsFailure = true))
    } else {
      // Using the counter
      // First 8 bytes are for the movingFactor
      // Compliant with base RFC 4226 (HOTP)
      val paddedTime = Totp.padLeft(timeWindow.toHexString.toUpperCase, 16, '0')
      // Get the HEX in a Byte[]
      val msg = Totp.hexStrToBytes(paddedTime)
      hmac_sha(secret, msg).map { hash =>
        val offset = hash(hash.length - 1) & 0xf
        val binary =
          ((hash(offset) & 0x7f) << 24) |
            ((hash(offset + 1) & 0xff) << 16) |
            ((hash(offset + 2) & 0xff) << 8) |
            (hash(offset + 3) & 0xff)
        val otpCode = binary % scala.math.pow(10, codeLength).toInt
        Totp.padLeft(otpCode.toString, codeLength, '0')
      }
    }
  }

  private def isSecretValid(secret: Secret): Boolean = secret.data.length == algorithm.secretLength

  private def hmac_sha(secret: Secret, text: Vector[Byte]): Attempt[Vector[Byte]] =
    Attempt.catchNonFatal {
      val hmac = Mac.getInstance(algorithm.alg)
      hmac.init(new SecretKeySpec(secret.data.toArray, "RAW"))
      hmac.doFinal(text.toArray).toVector
    } {
      case gse: GeneralSecurityException =>
        AuthenticationFailure("Failed to generate hash for TOTP", Some(gse), reportAsFailure = true)
    }
}
