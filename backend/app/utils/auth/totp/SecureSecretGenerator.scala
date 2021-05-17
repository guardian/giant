package utils.auth.totp

import java.security.SecureRandom

import utils.Stopwatch
import utils.Logging

class SecureSecretGenerator extends Logging {

  val (secureRandom, time) = Stopwatch.measure {
    logger.info("Creating SecureRandom instance")
    val secureRandom: SecureRandom = SecureRandom.getInstanceStrong
    logger.info("Seeding instance")
    // immediately seed the generator - this is good practice
    secureRandom.nextBoolean()
    secureRandom
  }

  if (time > 15000) {
    logger.warn("SecureRandom instance seeded - this took over 15 seconds which is an indication of low entropy on the server; you should investigate how to improve this.")
  } else {
    logger.info("SecureRandom instance seeded")
  }

  def createRandomSecret(alg: Algorithm): Secret = {
    val array = new Array[Byte](alg.secretLength)
    secureRandom.nextBytes(array)
    Secret(array.toVector)
  }
}
