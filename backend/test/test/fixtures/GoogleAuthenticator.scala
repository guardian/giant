package test.fixtures

import java.time.{LocalDateTime, ZoneOffset}

import utils.auth.totp.Base32Secret
import utils.Epoch

object GoogleAuthenticator {
  // these have been eyeballed on the official Google Authenticator app
  val sampleSecret = Base32Secret("HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ")
  val sampleTime = LocalDateTime.of(2017, 12, 5, 11, 5, 0)
  val sampleEpoch = Epoch(sampleTime.toEpochSecond(ZoneOffset.UTC))
  val sampleAnswers = List("703365", "849621", "180272", "254200", "247225")
}
