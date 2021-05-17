package users

import test.integration.Neo4jTestService
import model.user.{BCryptPassword, DBUser, UserPermissions}
import org.scalamock.scalatest.MockFactory
import services.annotations.Annotations
import services.index.{Index, Pages}
import services.manifest.Neo4jManifest
import services.users.Neo4jUserManagement
import test.fixtures.GoogleAuthenticator
import utils.Logging

import scala.concurrent.ExecutionContext.Implicits.global
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import utils.attempt.Attempt

class Neo4jUserManagementITest extends AnyFreeSpec with Matchers with Neo4jTestService with Logging with MockFactory {
  "Neo4JUserManagement" - {
    val user = DBUser("test", displayName = None, password = None, Some(1234), registered = false, totpSecret = Some(GoogleAuthenticator.sampleSecret))
    val permissions = UserPermissions.bigBoss

    "Can create a new user" in {
      new TestSetup {
        users.createUser(user, permissions).successValue shouldBe user
      }
    }

    "Can create default resources when a new user registers" in {
      val displayName = "Test User"
      val password = Some(BCryptPassword("$1$1$1$"))
      val totpSecret = Some(GoogleAuthenticator.sampleSecret)

      val expected = user.copy(
        registered = true,
        displayName = Some(displayName),
        password = password,
        totpSecret = totpSecret
      )

      new TestSetup {
        users.registerUser(user.username, displayName, password, totpSecret).successValue shouldBe expected
        users.getVisibleCollectionUrisForUser(user.username).successValue should be(Set(s"$displayName Documents"))
      }
    }
  }

  class TestSetup {
    val manifest = Neo4jManifest.setupManifest(neo4jDriver, global, neo4jQueryLoggingConfig).right.value

    val index = stub[Index]
    val pages = stub[Pages]

    val annotations = stub[Annotations]

    val users = Neo4jUserManagement(neo4jDriver, global, neo4jQueryLoggingConfig, manifest, index, pages, annotations)
  }
}
