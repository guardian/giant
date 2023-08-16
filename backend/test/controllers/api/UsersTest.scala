package controllers.api

import model.frontend.TotpActivation
import model.frontend.user.UserRegistration
import model.user.{BCryptPassword, NewUser, UserPermissions}
import org.scalatest.concurrent.ScalaFutures
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import play.api.libs.json.{JsArray, JsObject, Json}
import play.api.mvc.{Action, AnyContentAsEmpty, Request, Results}
import play.api.test.FakeRequest
import play.api.test.Helpers._
import services.users.UserManagement
import test.integration.Helpers.stubControllerComponentsAsUser
import test.{AttemptValues, TestUserManagement, TestUserRegistration}
import utils.auth.providers.DatabaseUserProvider

class UsersTest extends AnyFreeSpec with Matchers with Results with ScalaFutures with AttemptValues {
  import test.TestUserManagement._

  import scala.concurrent.ExecutionContext.Implicits.global

  val admin = user("admin", permissions = UserPermissions.bigBoss)
  val punter = user("punter")
  val unregisteredPunter = unregisteredUser("newPunter")

  "UsersController" - {
    "list partial user information to punters" in {
      TestSetup(punter) { (controller, _, _) =>
        val result = controller.listUsers.apply(FakeRequest())
        val json = contentAsJson(result)

        val users = (json \ "users").as[JsArray].value
        users should have length 3

        users.collect { case user: JsObject =>
          user.fields.map(_._1) should contain only("username", "displayName")
        }
      }
    }

    "list full user information to admins" in {
      TestSetup(admin) { (controller, _, _) =>
        val result = controller.listUsers.apply(FakeRequest())
        val json = contentAsJson(result)

        val users = (json \ "users").as[JsArray].value
        users should have length 3

        users.collect { case user: JsObject =>
          user.fields.map(_._1) should contain only("username", "displayName", "collections", "permissions")
        }
      }
    }

    "get user permissions" in {
      TestSetup(admin) { (controller, _, _) =>
        val result = controller.getMyPermissions.apply(FakeRequest())
        val json = contentAsJson(result)

        json.as[UserPermissions] should be(UserPermissions.bigBoss)
      }

      TestSetup(punter) { (controller, _, _) =>
        val result = controller.getMyPermissions.apply(FakeRequest())
        val json = contentAsJson(result)

        json.as[UserPermissions] should be(UserPermissions.default)
      }
    }

    "disallow operations without permission" in {
      TestSetup(punter) { (controller, _, _) =>
        def disallow[T](action: Action[T], body: T) = {
          val req: Request[T] = FakeRequest().withBody(body)
          val resp = action.apply(req)

          status(resp) should be(403)
        }

        disallow(controller.createUser("test"), Json.toJson(NewUser("test", "biglongpassword1234")))
        disallow(controller.removeUser(admin.username), AnyContentAsEmpty)

        disallow(controller.updateUserFullname(punter.username), Json.parse("""{"displayName": "test"}"""))
        disallow(controller.updateUserPassword(punter.username), Json.parse("""{"password": "biglongpassword1234"}"""))
      }
    }

    "create user that is flagged as not registered" in {
      TestSetup(admin) { (controller, db, _) =>
        val req = FakeRequest().withBody(Json.toJson(NewUser("test", "biglongpassword1234")))

        status(controller.createUser("test").apply(req)) should be(200)

        val users = db.listUsers().asFuture.futureValue.toOption.get
        users.find(_._1.username == "test").map(_._1.registered) should contain(false)
      }
    }

    "the register user flow" - {
      import test.fixtures.GoogleAuthenticator._

      val username = unregisteredPunter.username

      "with require2FA set to false" - {
        "password and registered flag should be updated" in {
          TestSetup(unregisteredPunter) { (controller, db, _) =>
            val params = UserRegistration(username, testPassword, "Punter", "newPassword", None)
            val req = FakeRequest().withBody(Json.toJson(params))

            status(controller.registerUser(username).apply(req)) should be(204)

            val user = db.getUser(username).successValue

            user.registered should be(true)
            user.password should not contain (testPasswordHashed)
          }
        }

        "2FA can be successfully enabled and secret set" in {
          TestSetup(unregisteredPunter) { (_, db, userProvider) =>
            val params = UserRegistration(username, testPassword, "Punter", "newPassword", Some(TotpActivation(sampleSecret.toBase32, sampleAnswers.head)))

            // Don't use the controller for this specific test so we can pass in the time for totp
            userProvider.registerUser(Json.toJson(params), sampleEpoch).successValue

            val user = db.getUser(username).successValue
            user.totpSecret should contain(sampleSecret)
          }
        }

        "fails if the 2FA code isn't valid" in {
          TestSetup(unregisteredPunter) { (controller, db, _) =>
            val params = UserRegistration(username, testPassword, "Punter", "newPassword", Some(TotpActivation(sampleSecret.toBase32, "000000")))
            val req = FakeRequest().withBody(Json.toJson(params))

            status(controller.registerUser(username).apply(req)) should be(400)

            val user = db.getUser(username).successValue
            user.registered should be(false)
          }
        }
      }

      "with require2FA set to true" - {
        "fails with a lack of 2FA information" in {
          TestSetup(unregisteredPunter, require2fa = true) { (controller, db, _) =>
            val params = UserRegistration(username, testPassword, "Punter", "newPassword", None)
            val req = FakeRequest().withBody(Json.toJson(params))

            status(controller.registerUser(username).apply(req)) should be(401)

            val user = db.getUser(username).successValue
            user.registered should be(false)
          }
        }
      }
    }
  }

  object TestSetup {
    def apply(reqUser: TestUserRegistration, require2fa: Boolean = false)(fn: (Users, UserManagement, DatabaseUserProvider) => Unit): Unit = {
      val (userProvider, userManagement) = TestUserManagement.makeUserProvider(require2fa, admin, punter, unregisteredPunter)

      val controllerComponents = stubControllerComponentsAsUser(reqUser.username, userManagement)
      val controller = new Users(controllerComponents, userProvider)

      fn(controller, userManagement, userProvider)
    }
  }
}
