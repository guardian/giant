package utils.auth.providers

import model.frontend.user.PartialUser
import model.frontend.TotpActivation
import model.user.{BCryptPassword, DBUser}
import play.api.libs.json.{JsBoolean, JsNumber, Json}
import play.api.mvc.{AnyContentAsFormUrlEncoded, Results}
import play.api.test.FakeRequest
import services.DatabaseAuthConfig
import services.users.UserManagement
import test.{AttemptValues, TestUserManagement}
import utils.auth.{PasswordHashing, PasswordValidator}
import utils.auth.totp.{Base32Secret, SecureSecretGenerator, Totp}
import utils.Epoch
import utils.attempt._

import scala.concurrent.ExecutionContext.Implicits.global
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class DatabaseUserProviderTest extends AnyFreeSpec with Matchers with AttemptValues with Results  {
  val hashing = new PasswordHashing(4)

  def makeUserProvider(config: DatabaseAuthConfig, users: UserManagement) = {
    new DatabaseUserProvider(
      config = config,
      passwordHashing = hashing,
      users = users,
      totp = Totp.googleAuthenticatorInstance(),
      ssg = new SecureSecretGenerator(),
      passwordValidator = new PasswordValidator(config.minPasswordLength)
    )
  }

  def anyContentForm(params: (String, String) *): AnyContentAsFormUrlEncoded = {
    AnyContentAsFormUrlEncoded(params.map { case (key, value) => key -> Seq(value)}.toMap)
  }

  "DatabaseUserProvider" - {

    val hardToGuessPassword = BCryptPassword("$2y$04$vZVs5a9NfK6GbyTuF6t22eNTmHcuzTMZftfLxiimNkkoO.spBvIZ6")

    val valentinesEpoch = Epoch.fromUtc(2019, 2, 14, 10)

    "client config is built correctly" in {
      val config = DatabaseAuthConfig(99, require2FA = true, "bob")
      val userProvider = makeUserProvider(config, TestUserManagement(Nil))

      userProvider.clientConfig shouldBe Map(
        "require2fa" -> JsBoolean(true),
        "minPasswordLength" -> JsNumber(99)
      )
    }

    "authentication" - {

      "authentication fails when the user is not in database" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val userProvider = makeUserProvider(config, TestUserManagement(Nil))

        val authResult = userProvider.authenticate(
          FakeRequest("GET", "/random").withBody(anyContentForm("username" -> "bob", "password" -> "bobby")),
          valentinesEpoch
        )

        authResult.failureValue shouldBe UserDoesNotExistFailure("bob")
      }


      "authentication fails when the password is wrong" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = None,
          invalidationTime = None,
          totpSecret = None
        )
        val userProvider = makeUserProvider(config, TestUserManagement(List(bob)))

        val authResult = userProvider.authenticate(
          FakeRequest("GET", "/random").withBody(anyContentForm("username" -> "bob", "password" -> "wrong")),
          valentinesEpoch
        )

        authResult.failureValue shouldBe LoginFailure("Incorrect password")
      }

      "authentication succeeds when the password is right and 2FA isn't required" in {
        val config = DatabaseAuthConfig(8, require2FA = false, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = None
        )
        val userProvider = makeUserProvider(config, TestUserManagement(List(bob)))

        val authResult = userProvider.authenticate(
          FakeRequest("GET", "/random").withBody(anyContentForm("username" -> "bob", "password" -> "hardtoguess")),
          valentinesEpoch
        )

        authResult.successValue shouldBe PartialUser("bob", "Bob Bob")
      }

      "authentication fails when the user is not enrolled in 2FA when 2FA is required" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = None
        )
        val userProvider = makeUserProvider(config, TestUserManagement(List(bob)))

        val authResult = userProvider.authenticate(
          FakeRequest("GET", "/random").withBody(anyContentForm("username" -> "bob", "password" -> "hardtoguess")),
          valentinesEpoch
        )

        authResult.failureValue shouldBe MisconfiguredAccount("2FA is required but user is not enrolled")
      }

      "authentication fails when the password is right but 2FA is required" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
        )
        val userProvider = makeUserProvider(config, TestUserManagement(List(bob)))

        val authResult = userProvider.authenticate(
          FakeRequest("GET", "/random").withBody(anyContentForm("username" -> "bob", "password" -> "hardtoguess")),
          valentinesEpoch
        )

        authResult.failureValue shouldBe SecondFactorRequired("2FA code required")
      }

      "authentication fails when the password is right but 2FA is wrong" in {

        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
        )
        val userProvider = makeUserProvider(config, TestUserManagement(List(bob)))

        val authResult = userProvider.authenticate(
          FakeRequest("GET", "/random").withBody(anyContentForm("username" -> "bob", "password" -> "hardtoguess", "tfa" -> "123456")),
          valentinesEpoch
        )

        authResult.failureValue shouldBe SecondFactorRequired("2FA code not valid")
      }

      "authentication succeeds when the password and 2FA are right" in {

        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
        )
        val userProvider = makeUserProvider(config, TestUserManagement(List(bob)))

        val authResult = userProvider.authenticate(
          FakeRequest("GET", "/random").withBody(anyContentForm("username" -> "bob", "password" -> "hardtoguess", "tfa" -> "836585")),
          valentinesEpoch
        )

        authResult.successValue shouldBe PartialUser("bob", "Bob Bob")
      }
    }


    "registerUser" - {
      "succeeds when 2FA not required" in {
        val config = DatabaseAuthConfig(8, require2FA = false, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = false,
          displayName = None,
          invalidationTime = None,
          totpSecret = None
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> "hardtoguess",
          "newPassword" -> "hardtoguess",
          "displayName" -> "Bob Bob"
        ), valentinesEpoch)

        result.successValue

        val bob2 = users.getUser("bob").successValue
        bob2.registered shouldBe true
        bob2.displayName shouldBe Some("Bob Bob")
        bob2.password shouldNot be(Some(hardToGuessPassword))
      }

      "succeeds when 2FA is required" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = false,
          displayName = None,
          invalidationTime = None,
          totpSecret = None
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> "hardtoguess",
          "newPassword" -> "hardtoguess",
          "displayName" -> "Bob Bob",
          "totpActivation" -> Json.obj(
            "secret" -> "JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5",
            "code" -> "836585"
          )
        ), valentinesEpoch)

        result.successValue

        val bob2 = users.getUser("bob").successValue
        bob2.registered shouldBe true
        bob2.totpSecret shouldBe Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
        bob2.displayName shouldBe Some("Bob Bob")
        bob2.password should not be Some(hardToGuessPassword)
      }

      "fails when password is wrong" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = false,
          displayName = None,
          invalidationTime = None,
          totpSecret = None
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> "wrongpassword",
          "newPassword" -> "hardtoguess",
          "displayName" -> "Bob Bob",
          "totpActivation" -> Json.obj(
            "secret" -> "JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5",
            "code" -> "836585"
          )
        ), valentinesEpoch)

        result.failureValue shouldBe LoginFailure("Incorrect password")

        users.getUser("bob").successValue shouldBe bob
      }

      "fails when new password is too short" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = false,
          displayName = None,
          invalidationTime = None,
          totpSecret = None
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> "hardtoguess",
          "newPassword" -> "short",
          "displayName" -> "Bob Bob",
          "totpActivation" -> Json.obj(
            "secret" -> "JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5",
            "code" -> "836585"
          )
        ), valentinesEpoch)

        result.failureValue shouldBe ClientFailure("Provided password too short, must be at least 8 characters")

        users.getUser("bob").successValue shouldBe bob
      }

      "fails when 2FA is wrong" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = false,
          displayName = None,
          invalidationTime = None,
          totpSecret = None
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> "hardtoguess",
          "newPassword" -> "hardtoguess",
          "displayName" -> "Bob Bob",
          "totpActivation" -> Json.obj(
            "secret" -> "JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5",
            "code" -> "123456"
          )
        ), valentinesEpoch)

        result.failureValue shouldBe ClientFailure("Sample 2FA code wasn't valid, check the time on your device")

        users.getUser("bob").successValue shouldBe bob
      }
    }


    "removeUser" in {
      val config = DatabaseAuthConfig(8, require2FA = true, "bob")
      val bob = DBUser(
        username = "bob",
        password = None,
        registered = true,
        displayName = Some("Bob Bob"),
        invalidationTime = None,
        totpSecret = Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
      )
      val users = TestUserManagement(List(bob))
      val userProvider = makeUserProvider(config, users)

      userProvider.removeUser("bob")

      users.getAllUsers shouldBe Nil
    }

    "updatePassword" - {
      "should update password" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        userProvider.updatePassword("bob", "myHarderToGuessPassword").successValue

        users.getUser("bob").successValue.password should not be Some(hardToGuessPassword)
      }

      "should prevent setting a password that is too short" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        userProvider.updatePassword("bob", "2short").failureValue shouldBe
          ClientFailure("Provided password too short, must be at least 8 characters")

        users.getUser("bob").successValue.password shouldBe Some(hardToGuessPassword)
      }
    }

    "enrollUser2FA" - {
      "succeeds when enrolling a correct 2FA" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = None
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        userProvider
          .enrollUser2FA("bob", TotpActivation("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5", "836585"), valentinesEpoch)
          .successValue

        users.getUser("bob").successValue.totpSecret shouldBe Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
      }

      "fails when sample code is wrong" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = None
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        userProvider
          .enrollUser2FA("bob", TotpActivation("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5", "123456"), valentinesEpoch)
          .failureValue shouldBe ClientFailure("Sample 2FA code wasn't valid, check the time on your device")

        users.getUser("bob").successValue shouldBe bob
      }
    }

    "removeUser2FA" - {
      "fails when 2FA is required" in {
        val config = DatabaseAuthConfig(8, require2FA = true, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        userProvider
          .removeUser2FA("bob")
          .failureValue shouldBe SecondFactorRequired("This system requires 2FA so you cannot disable it.")

        users.getUser("bob").successValue shouldBe bob
      }

      "succeeds" in {
        val config = DatabaseAuthConfig(8, require2FA = false, "bob")
        val bob = DBUser(
          username = "bob",
          password = Some(hardToGuessPassword),
          registered = true,
          displayName = Some("Bob Bob"),
          invalidationTime = None,
          totpSecret = Some(Base32Secret("JCZAB5QQN5QNAPLG27MT4O5XZWDXRIH5"))
        )
        val users = TestUserManagement(List(bob))
        val userProvider = makeUserProvider(config, users)

        userProvider
          .removeUser2FA("bob")
          .successValue

        users.getUser("bob").successValue.totpSecret shouldBe None
      }
    }
  }

}
