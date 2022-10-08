package controllers.genesis

import model.frontend.user.{NewGenesisUser, PartialUser}
import model.user.{BCryptPassword, DBUser, NewUser, UserPermissions}
import org.scalatest.time.{Millis, Seconds, Span}
import play.api.libs.json._
import play.api.mvc.Results
import play.api.test.Helpers._
import play.api.test.{FakeRequest, Helpers}
import services.DatabaseAuthConfig
import services.users.UserManagement
import test.{AttemptValues, TestUserManagement}
import utils.Logging
import utils.auth.totp.{SecureSecretGenerator, Totp}
import utils.auth.{PasswordHashing, PasswordValidator}
import utils.auth.providers.DatabaseUserProvider
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class GenesisTest extends AnyFreeSpec with Matchers with Results with AttemptValues with Logging {
  import scala.concurrent.ExecutionContext.Implicits.global

  private val controllerComponents = Helpers.stubControllerComponents()
  private val config = new DatabaseAuthConfig(12, false, "pfi")
  private val hashing = new PasswordHashing(7)
  private val validator = new PasswordValidator(config.minPasswordLength)
  private val generator = new SecureSecretGenerator
  private val totp = Totp.googleAuthenticatorInstance()

  implicit override val patienceConfig = PatienceConfig(scaled(Span(2, Seconds)), scaled(Span(15, Millis)))

  def provider(userManagement: UserManagement) =
    new DatabaseUserProvider(config, hashing, userManagement, totp, generator, validator)

  "Genesis controller" - {
    "with an empty database" - {
      val userManagement = TestUserManagement(Nil)
      val userProvider = provider(userManagement)
      val controllerWithNoUsers = new Genesis(controllerComponents, userProvider, userManagement, true)

      "executing the checkSetup action" - {
        "should return setupCompleted: false" in {
          val result = controllerWithNoUsers.checkSetup.apply(FakeRequest())
          val json = contentAsJson(result)
          json \ "setupComplete" shouldBe JsDefined(JsBoolean(false))
        }
      }

      "executing the doSetup action" - {
        "should enforce the minimum password length" in {
          val body: JsValue = Json.toJson(NewGenesisUser("bob", "Spongebob", "password", None))
          val result = controllerWithNoUsers.doSetup().apply(FakeRequest().withBody(body))
          val string = contentAsString(result)
          string shouldBe "Provided password too short, must be at least 12 characters"
          val statusCode = status(result)
          statusCode shouldBe 400
        }

        "should create a user" in {
          val body: JsValue = Json.toJson(NewGenesisUser("bob", "Spongebob", "bobs-password", None))
          val result = controllerWithNoUsers.doSetup().apply(FakeRequest().withBody(body))
          val json = contentAsJson(result)
          json.as[PartialUser] shouldBe PartialUser("bob", "Spongebob")

          val dbUsers = userManagement.listUsers().asFuture.futureValue.toOption.get
          dbUsers should have length 1
          dbUsers.head._1.registered should not be false
        }
      }

      "executing the checkSetup action again" - {
        "should return setupCompleted: true" in {
          val result = controllerWithNoUsers.checkSetup.apply(FakeRequest())
          val json = contentAsJson(result)
          json \ "setupComplete" shouldBe JsDefined(JsBoolean(true))
        }
      }
    }

    "simulating another node running genesis with an empty database" - {
      val userManagement = TestUserManagement(Nil)
      val controllerWithNoUsers = new Genesis(controllerComponents, provider(userManagement), userManagement, true)

      "executing the checkSetup action" - {
        "should return setupCompleted: false" in {
          val result = controllerWithNoUsers.checkSetup.apply(FakeRequest())
          val json = contentAsJson(result)
          json \ "setupComplete" shouldBe JsDefined(JsBoolean(false))
        }
      }

      "executing the checkSetup action again" - {
        "should return setupCompleted: true when another node has inserted a user" in {
          userManagement.createUser(
            DBUser("bob", Some("bob"), Some(BCryptPassword("bad-hash")), None, registered = false, None), UserPermissions(Set.empty)
          )
          val result = controllerWithNoUsers.checkSetup.apply(FakeRequest())
          val json = contentAsJson(result)
          json \ "setupComplete" shouldBe JsDefined(JsBoolean(true))
        }
      }
    }

    "with a user in the database" - {
      val management = TestUserManagement(List(DBUser("bob", Some("bob"), Some(BCryptPassword("bad-hash")), None, registered = false, None)))
      val controllerWithAUser = new Genesis(controllerComponents, provider(management), management, true)

      "executing the checkSetup action" - {
        "should return setupCompleted: true" in {
          val result = controllerWithAUser.checkSetup.apply(FakeRequest())
          val json = contentAsJson(result)
          json \ "setupComplete" shouldBe JsDefined(JsBoolean(true))
        }
      }

      "executing the doSetup action" - {
        "should fail" in {
          val body: JsValue = Json.toJson(NewUser("bob", "bobs-password"))
          val result = controllerWithAUser.doSetup().apply(FakeRequest().withBody(body))
          val statusCode = status(result)
          statusCode shouldBe 409
        }
      }
    }

    "with the genesis flow disabled" - {
      val management = TestUserManagement(Nil)
      val controllerWithNoUsers =
        new Genesis(controllerComponents, provider(management), management, false)

      "executing the checkSetup action" - {
        "should return setupCompleted: true" in {
          val result = controllerWithNoUsers.checkSetup.apply(FakeRequest())
          val json = contentAsJson(result)
          json \ "setupComplete" shouldBe JsDefined(JsBoolean(true))
        }
      }

      "executing the doSetup action" - {
        "should fail" in {
          val body: JsValue = Json.toJson(NewUser("bob", "bobs-password"))
          val result = controllerWithNoUsers.doSetup().apply(FakeRequest().withBody(body))
          val statusCode = status(result)
          statusCode shouldBe 403
        }
      }
    }
  }
}
