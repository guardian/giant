package controllers.api


import java.time.Instant
import java.util.concurrent.TimeUnit
import org.apache.pekko.util.Timeout
import model.Uri
import model.manifest.Collection
import model.user.UserPermission.CanPerformAdminOperations
import model.user.{DBUser, UserPermissions}
import play.api.test.Helpers.contentAsJson
import play.api.test.{FakeRequest, Helpers}
import services.events.{ActionComplete, Event}
import test.{TestAuthActionBuilder, TestEventsService, TestUserManagement, TestUserRegistration}
import utils.auth.User
import test.integration.Helpers.stubControllerComponentsAsUser
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class EventsTest extends AnyFunSuite with Matchers {
  import TestUserManagement._

  implicit val timeout: Timeout = Timeout(10, TimeUnit.SECONDS)

  val collectionOne = Collection(Uri("one"), "one", List.empty, None)
  val collectionTwo = Collection(Uri("two"), "two", List.empty, None)

  val punter = user("punter", collections = List(collectionOne))
  val admin = user("admin", permissions = UserPermissions.bigBoss)

  val initialEvents = List(
    uploadEvent(collectionOne.uri.value, punter.username),
    uploadEvent(collectionOne.uri.value, admin.username),
    uploadEvent(collectionTwo.uri.value, admin.username)
  )

  test("return all uploads from non-admins to admins") {
    new TestSetup(
      users = List(punter, admin),
      requestUser = admin,
      initialEvents = initialEvents
    ) {
      val result = controller.listAllUploads(None).apply(FakeRequest())
      val json = contentAsJson(result)

      val events = (json \ "events").as[List[Event]]
      events must have length 1

      events.head.tags("username") must be(punter.username)
    }
  }

  test("return all uploads") {
    new TestSetup(
      users = List(punter, admin),
      requestUser = admin,
      initialEvents = initialEvents
    ) {
      val result = controller.listAllUploads(showAdminUploads = Some(true)).apply(FakeRequest())
      val json = contentAsJson(result)

      val events = (json \ "events").as[List[Event]]
      events must have length 3
    }
  }

  class TestSetup(users: List[TestUserRegistration], requestUser: TestUserRegistration, initialEvents: List[Event]) {
    val userManagement = TestUserManagement(users)
    val controllerComponents = stubControllerComponentsAsUser(requestUser.username, userManagement)
    val eventsService = new TestEventsService(initialEvents)

    val controller = new Events(controllerComponents, eventsService)
  }

  private def uploadEvent(collection: String, username: String): Event = {
    Event(ActionComplete, Instant.now().toEpochMilli, "",
      Map("type" -> "upload", "collection" -> collection, "username" -> username))
  }
}
