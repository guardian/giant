package utils.auth.totp

import java.text.SimpleDateFormat
import java.time.{LocalDateTime, ZoneOffset}
import java.util.{Date, TimeZone}

import org.scalatest.prop.{TableDrivenPropertyChecks}
import test.AttemptValues
import utils.attempt.{ClientFailure, Failure, MisconfiguredAccount, SecondFactorRequired}
import utils.Epoch
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class TotpGeneratorTest extends AnyFreeSpec with Matchers with AttemptValues with TableDrivenPropertyChecks {
  /*
  From the RFC
  +-------------+--------------+------------------+----------+--------+
  |  Time (sec) |   UTC Time   | Value of T (hex) |   TOTP   |  Mode  |
  +-------------+--------------+------------------+----------+--------+
  |      59     |  1970-01-01  | 0000000000000001 | 94287082 |  SHA1  |
  |             |   00:00:59   |                  |          |        |
  |      59     |  1970-01-01  | 0000000000000001 | 46119246 | SHA256 |
  |             |   00:00:59   |                  |          |        |
  |      59     |  1970-01-01  | 0000000000000001 | 90693936 | SHA512 |
  |             |   00:00:59   |                  |          |        |
  |  1111111109 |  2005-03-18  | 00000000023523EC | 07081804 |  SHA1  |
  |             |   01:58:29   |                  |          |        |
  |  1111111109 |  2005-03-18  | 00000000023523EC | 68084774 | SHA256 |
  |             |   01:58:29   |                  |          |        |
  |  1111111109 |  2005-03-18  | 00000000023523EC | 25091201 | SHA512 |
  |             |   01:58:29   |                  |          |        |
  |  1111111111 |  2005-03-18  | 00000000023523ED | 14050471 |  SHA1  |
  |             |   01:58:31   |                  |          |        |
  |  1111111111 |  2005-03-18  | 00000000023523ED | 67062674 | SHA256 |
  |             |   01:58:31   |                  |          |        |
  |  1111111111 |  2005-03-18  | 00000000023523ED | 99943326 | SHA512 |
  |             |   01:58:31   |                  |          |        |
  |  1234567890 |  2009-02-13  | 000000000273EF07 | 89005924 |  SHA1  |
  |             |   23:31:30   |                  |          |        |
  |  1234567890 |  2009-02-13  | 000000000273EF07 | 91819424 | SHA256 |
  |             |   23:31:30   |                  |          |        |
  |  1234567890 |  2009-02-13  | 000000000273EF07 | 93441116 | SHA512 |
  |             |   23:31:30   |                  |          |        |
  |  2000000000 |  2033-05-18  | 0000000003F940AA | 69279037 |  SHA1  |
  |             |   03:33:20   |                  |          |        |
  |  2000000000 |  2033-05-18  | 0000000003F940AA | 90698825 | SHA256 |
  |             |   03:33:20   |                  |          |        |
  |  2000000000 |  2033-05-18  | 0000000003F940AA | 38618901 | SHA512 |
  |             |   03:33:20   |                  |          |        |
  | 20000000000 |  2603-10-11  | 0000000027BC86AA | 65353130 |  SHA1  |
  |             |   11:33:20   |                  |          |        |
  | 20000000000 |  2603-10-11  | 0000000027BC86AA | 77737706 | SHA256 |
  |             |   11:33:20   |                  |          |        |
  | 20000000000 |  2603-10-11  | 0000000027BC86AA | 47863826 | SHA512 |
  |             |   11:33:20   |                  |          |        |
  +-------------+--------------+------------------+----------+--------+
  */

  case class Crypto(alg: Algorithm, sampleSecret: Secret)
  case class TotpSample(time: Epoch, totp: String, crypto: Crypto)

  val sha1 = Crypto(Algorithm.HmacSHA1, HexSecret("3132333435363738393031323334353637383930"))
  val sha256 = Crypto(Algorithm.HmacSHA256, HexSecret("3132333435363738393031323334353637383930313233343536373839303132"))
  val sha512 = Crypto(Algorithm.HmacSHA512, HexSecret("31323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334"))

  val tests = List(
    TotpSample(Epoch(59), "94287082", sha1),
    TotpSample(Epoch(59), "46119246", sha256),
    TotpSample(Epoch(59), "90693936", sha512),
    TotpSample(Epoch(1111111109), "07081804", sha1),
    TotpSample(Epoch(1111111109), "68084774", sha256),
    TotpSample(Epoch(1111111109), "25091201", sha512),
    TotpSample(Epoch(1111111111), "14050471", sha1),
    TotpSample(Epoch(1111111111), "67062674", sha256),
    TotpSample(Epoch(1111111111), "99943326", sha512),
    TotpSample(Epoch(1234567890), "89005924", sha1),
    TotpSample(Epoch(1234567890), "91819424", sha256),
    TotpSample(Epoch(1234567890), "93441116", sha512),
    TotpSample(Epoch(2000000000), "69279037", sha1),
    TotpSample(Epoch(2000000000), "90698825", sha256),
    TotpSample(Epoch(2000000000), "38618901", sha512),
    TotpSample(Epoch(20000000000L), "65353130", sha1),
    TotpSample(Epoch(20000000000L), "77737706", sha256),
    TotpSample(Epoch(20000000000L), "47863826", sha512),
  )

  "Totp" - {
    import scala.concurrent.ExecutionContext.Implicits.global
    import test.fixtures.GoogleAuthenticator._

    "The RFC TOTP samples should all pass correctly" in {
      tests.foreach { case TotpSample(epoch, sampleTotp, Crypto(crypto, secret)) =>
        val totpGenerator = new Totp(8, crypto, 0)
        val steps = Totp.getTimeWindow(epoch)
        val df = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
        df.setTimeZone(TimeZone.getTimeZone("UTC"))
        val utcTime = df.format(new Date(epoch.seconds * 1000))
        val actualOtp = totpGenerator.
          generate(secret, steps).successValue
        actualOtp shouldBe sampleTotp
      }
    }

    "We should generate a range of values when using generateTOTPs" in {
      val totpGenerator = new Totp(8, sha1.alg, 2)
      val codes = totpGenerator.generateList(sha1.sampleSecret, Epoch(1111111109)).successValue
      codes.size shouldBe 5
      codes(2) shouldBe "07081804"
    }

    "Google Authenticator" - {
      "The google auth instance should use the right settings" in {
        val totp = Totp.googleAuthenticatorInstance()
        totp.algorithm shouldBe Algorithm.HmacSHA1
        totp.codeLength shouldBe 6
      }

      "Should correctly parse a Base32 secret and generate codes" in {
        val totp = Totp.googleAuthenticatorInstance()
        val codes = totp.generateList(sampleSecret, sampleEpoch)
        codes.successValue shouldBe sampleAnswers
      }

      "The Base32 encode and decode functions are symmetric" in {
        val sha1Secret = "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"
        Totp.bytesToBase32(Totp.base32ToBytes(sha1Secret)) shouldBe sha1Secret
      }
    }

    "Random generation" ignore {
      // WARNING: This test might block if there isn't enough random...
      "We can't really test whether random is secure, but let's make sure we've not been stupid" in {
        val generator1 = new SecureSecretGenerator
        val generator2 = new SecureSecretGenerator
        // if we seed them the same then this will be the same
        generator1.createRandomSecret(Algorithm.HmacSHA1) should not be generator2.createRandomSecret(Algorithm.HmacSHA1)
      }
    }

    "Code checking" - {
      "checkCode" - {
        "should return false if a token is not valid in a time slot" in {
          val totp = Totp.googleAuthenticatorInstance()
          val result = totp.checkCode(sampleSecret, "000000", sampleEpoch).successValue
          result shouldBe false
        }

        "should return true for any of the codes in the sample window" in {
          val totp = Totp.googleAuthenticatorInstance()
          sampleAnswers.foreach { code =>
            val result = totp.checkCode(sampleSecret, code, sampleEpoch).successValue
            result shouldBe true
          }
        }
      }

      "checkUser2fa" - {
        val totp = Totp.googleAuthenticatorInstance()

        case class Permutation(required: Boolean, secret: Option[Secret], code: Option[String], expect: Either[Failure, Boolean])
        val codeRequired = Left(SecondFactorRequired("2FA code required"))
        val notEnrolled = Left(MisconfiguredAccount("2FA is required but user is not enrolled"))
        val badCode = Left(SecondFactorRequired("2FA code not valid"))
        val permutations = Table(
          ("require2FA",  "totpSecret",         "maybeCode",                "expected"),
          (true,          Some(sampleSecret),   sampleAnswers.headOption,   Right(true)),
          (true,          Some(sampleSecret),   Some("000000"),             badCode),
          (true,          Some(sampleSecret),   None,                       codeRequired),
          (true,          None,                 sampleAnswers.headOption,   notEnrolled),
          (true,          None,                 Some("000000"),             notEnrolled),
          (true,          None,                 None,                       notEnrolled),
          (false,         Some(sampleSecret),   sampleAnswers.headOption,   Right(true)),
          (false,         Some(sampleSecret),   Some("000000"),             badCode),
          (false,         Some(sampleSecret),   None,                       codeRequired),
          (false,         None,                 sampleAnswers.headOption,   Right(false)),
          (false,         None,                 Some("000000"),             Right(false)),
          (false,         None,                 None,                       Right(false))
        )

        "all permutations should pass" in {
          forAll(permutations) { (require2FA, totpSecret, maybeCode, expected) =>
            val result = totp.checkUser2fa(require2FA, totpSecret, maybeCode, sampleEpoch).eitherValue
            result shouldBe expected
          }
        }
      }
    }
  }
}
