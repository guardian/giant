package utils.auth.providers

import model.frontend.user.PartialUser
import model.user.NewUser
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import play.api.libs.json.{JsBoolean, JsNumber, JsString, Json}
import play.api.mvc.{AnyContentAsFormUrlEncoded, Results}
import play.api.test.FakeRequest
import test.{AttemptValues, TestUserManagement}
import utils.attempt._

class DatabaseUserProviderTest extends AnyFreeSpec with Matchers with AttemptValues with Results  {
  import TestUserManagement._
  import test.fixtures.GoogleAuthenticator._

  def formParams(username: String, password: String, tfa: Option[String] = None): FakeRequest[AnyContentAsFormUrlEncoded] =
    FakeRequest("GET", "/endpoint").withBody(
      AnyContentAsFormUrlEncoded(List(
        Some("username" -> Seq(username)),
        Some("password" -> Seq(password)),
        tfa.map(v => "tfa" -> Seq(v))
      ).flatten.toMap)
    )

  "DatabaseUserProvider" - {
    "client config is built correctly" in {
      val (userProvider, _) = makeUserProvider(require2fa = true)

      userProvider.clientConfig shouldBe Map(
        "require2fa" -> JsBoolean(true),
        "minPasswordLength" -> JsNumber(userProvider.config.minPasswordLength)
      )
    }

    "authentication" - {

      "authentication fails when the user is not in database" in {
        val (userProvider, _) = makeUserProvider(require2fa = true)

        val authResult = userProvider.authenticate(
          formParams(username = "bob", password = "bobby"),
          sampleEpoch
        )

        authResult.failureValue shouldBe UserDoesNotExistFailure("bob")
      }


      "authentication fails when the password is wrong" in {
        val (userProvider, _) = makeUserProvider(require2fa = true, user("bob"))

        val authResult = userProvider.authenticate(
          formParams(username = "bob", password = "wrong"),
          sampleEpoch
        )

        authResult.failureValue shouldBe LoginFailure("Incorrect password")
      }

      "authentication succeeds when the password is right and 2FA isn't required" in {
        val (userProvider, _) = makeUserProvider(require2fa = false,
          user("bob", Some("Bob Bob")))

        val authResult = userProvider.authenticate(
          formParams(username = "bob", password = testPassword),
          sampleEpoch
        )

        authResult.successValue shouldBe PartialUser("bob", "Bob Bob")
      }

      "authentication fails when the user is not enrolled in 2FA when 2FA is required" in {
        val (userProvider, _) = makeUserProvider(require2fa = true, user("bob"))

        val authResult = userProvider.authenticate(
          formParams(username = "bob", password = testPassword),
          sampleEpoch
        )

        authResult.failureValue should be(MisconfiguredAccount("2FA is required but user is not enrolled"))
      }

      "authentication fails when the password is right but 2FA is required" in {
        val (userProvider, _) = makeUserProvider(require2fa = true, totpUser("bob"))

        val authResult = userProvider.authenticate(
          formParams(username = "bob", password = testPassword),
          sampleEpoch
        )

        authResult.failureValue shouldBe a[SecondFactorRequired]
      }

      "authentication fails when the password is right but 2FA is wrong" in {
        val (userProvider, _) = makeUserProvider(require2fa = true, totpUser("bob"))

        val authResult = userProvider.authenticate(
          formParams(username = "bob", password = testPassword, tfa = Some("123456")),
          sampleEpoch
        )

        authResult.failureValue shouldBe SecondFactorRequired("2FA code not valid")
      }

      "authentication succeeds when the password and 2FA are right" in {
        val (userProvider, _) = makeUserProvider(require2fa = true,
          totpUser("bob", displayName = Some("Bob Bob Ricard")))

        val authResult = userProvider.authenticate(
          formParams(username = "bob", password = testPassword, tfa = Some(sampleAnswers.head)),
          sampleEpoch
        )

        authResult.successValue shouldBe PartialUser("bob", "Bob Bob Ricard")
      }
    }

    "createUser" - {
      "fails if username does not match record in database" in {
        val (userProvider, _) = makeUserProvider(require2fa = true)

        val result = userProvider.createUser("bob", Json.toJson(NewUser("sheila", testPassword)))
        result.failureValue shouldBe ClientFailure("Username in URL didn't match that in payload.")
      }

      "fails if temporary password does not meet requirements" in {
        val (userProvider, _) = makeUserProvider(require2fa = true)

        val result = userProvider.createUser("bob", Json.toJson(NewUser("bob", "a")))
        result.failureValue shouldBe ClientFailure(s"Provided password too short, must be at least ${userProvider.config.minPasswordLength} characters")
      }

      "creates user and generates initial 2fa configuration" in {
        val (userProvider, users) = makeUserProvider(require2fa = true)

        val result = userProvider.createUser("bob", Json.toJson(NewUser("bob", testPassword)))
        result.successValue shouldBe PartialUser("bob", "New User")
      }
    }

    "registerUser" - {
      "succeeds when 2FA not required" in {
        val (userProvider, users) = makeUserProvider(require2fa = false, unregisteredUser("bob"))

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> testPassword,
          "newPassword" -> testPassword,
          "displayName" -> "Bob Bob Ricard"
        ), sampleEpoch)

        result.successValue

        val bob = users.getUser("bob").successValue
        bob.registered shouldBe true
        bob.displayName shouldBe Some("Bob Bob Ricard")
        bob.password shouldNot be(Some(testPasswordHashed))
      }

      "fails when password is wrong" in {
        val (userProvider, users) = makeUserProvider(require2fa = false, unregisteredUser("bob"))
        val unregisteredBob = users.getUser("bob").successValue

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> "wrongpassword",
          "newPassword" -> testPassword,
          "displayName" -> "Bob Bob"
        ), sampleEpoch)

        result.failureValue shouldBe LoginFailure("Incorrect password")

        users.getUser("bob").successValue shouldBe unregisteredBob
      }

      "fails when new password is too short" in {
        val (userProvider, users) = makeUserProvider(require2fa = false, unregisteredUser("bob"))
        val unregisteredBob = users.getUser("bob").successValue

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> testPassword,
          "newPassword" -> "a",
          "displayName" -> "Bob Bob"
        ), sampleEpoch)

        result.failureValue shouldBe ClientFailure("Provided password too short, must be at least 8 characters")

        users.getUser("bob").successValue shouldBe unregisteredBob
      }

      "fails when 2FA is wrong" in {
        val baseUser = totpUser("bob")
        val user = baseUser.copy(dbUser = baseUser.dbUser.copy(registered = false))

        val (userProvider, users) = makeUserProvider(require2fa = true, user)
        val unregisteredBob = users.getUser("bob").successValue

        val result = userProvider.registerUser(Json.obj(
          "username" -> "bob",
          "previousPassword" -> testPassword,
          "newPassword" -> testPassword,
          "displayName" -> "Bob Bob",
          "tfa" -> Json.obj(
            "type" -> "totp",
            "code" -> "123456"
          )
        ), sampleEpoch)

        result.failureValue shouldBe SecondFactorRequired("2FA enrollment is required")

        users.getUser("bob").successValue shouldBe unregisteredBob
      }
    }

    "removeUser" in {
      val (userProvider, users) = makeUserProvider(require2fa = true, totpUser("bob"))

      userProvider.removeUser("bob").successValue
      users.getAllUsers shouldBe Nil
    }

    "updatePassword" - {
      "should update password" in {
        val (userProvider, users) = makeUserProvider(require2fa = true, totpUser("bob"))
        val hashedPasswordBefore = users.getUser("bob").successValue.password.get

        userProvider.updatePassword("bob", "myHarderToGuessPassword").successValue

        users.getUser("bob").successValue.password should not be Some(hashedPasswordBefore)
      }

      "should prevent setting a password that is too short" in {
        val (userProvider, users) = makeUserProvider(require2fa = true, totpUser("bob"))
        val hashedPasswordBefore = users.getUser("bob").successValue.password.get

        userProvider.updatePassword("bob", "2short").failureValue shouldBe
          ClientFailure("Provided password too short, must be at least 8 characters")

        users.getUser("bob").successValue.password shouldBe Some(hashedPasswordBefore)
      }
    }
  }
}
