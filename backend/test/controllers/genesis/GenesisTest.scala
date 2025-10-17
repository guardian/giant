package controllers.genesis

import model.frontend.user.{NewGenesisUser, PartialUser}
import model.user.{NewUser, UserPermissions}
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.time.{Millis, Seconds, Span}
import play.api.libs.json._
import play.api.mvc.Results
import play.api.test.Helpers._
import play.api.test.{FakeRequest, Helpers}
import test.{AttemptValues, TestUserManagement}
import utils.Logging

class GenesisTest extends AnyFreeSpec with Matchers with Results with AttemptValues with Logging {
  import TestUserManagement._

  import scala.concurrent.ExecutionContext.Implicits.global

  private val controllerComponents = Helpers.stubControllerComponents()

  implicit override val patienceConfig: PatienceConfig = PatienceConfig(scaled(Span(2, Seconds)), scaled(Span(15, Millis)))

  "Genesis controller" - {
    "with an empty database" - {
      val (userProvider, userManagement) = makeUserProvider(require2fa = false)
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
          val body: JsValue = Json.toJson(NewGenesisUser("bob", "Spongebob", "a", None))
          val result = controllerWithNoUsers.doSetup().apply(FakeRequest().withBody(body))
          val string = contentAsString(result)
          string shouldBe "Provided password too short, must be at least 8 characters"
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
      val (userProvider, userManagement) = makeUserProvider(require2fa = false)
      val controllerWithNoUsers = new Genesis(controllerComponents, userProvider, userManagement, true)

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
            unregisteredUser("bob").dbUser, UserPermissions.default
          )
          val result = controllerWithNoUsers.checkSetup.apply(FakeRequest())
          val json = contentAsJson(result)
          json \ "setupComplete" shouldBe JsDefined(JsBoolean(true))
        }
      }
    }

    "with a user in the database" - {
      val (userProvider, userManagement) = makeUserProvider(require2fa = false, user("bob"))
      val controllerWithAUser = new Genesis(controllerComponents, userProvider, userManagement, true)

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
      val (userProvider, userManagement) = makeUserProvider(require2fa = false)
      val controllerWithNoUsers = new Genesis(controllerComponents, userProvider, userManagement, false)

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
