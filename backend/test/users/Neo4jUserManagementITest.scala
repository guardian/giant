package users

import com.dimafeng.testcontainers.Neo4jContainer
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import model.user.{BCryptPassword, DBUser, UserPermissions}
import org.scalamock.scalatest.MockFactory
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import services.annotations.Annotations
import services.index.{Index, Pages}
import services.manifest.Neo4jManifest
import services.users.Neo4jUserManagement
import test.AttemptValues
import test.fixtures.GoogleAuthenticator
import test.integration.{Neo4jTestContainer, Neo4jTestService}
import utils.Logging

import scala.concurrent.ExecutionContext.Implicits.global

class Neo4jUserManagementITest extends AnyFreeSpec with Matchers with TestContainersForAll with Neo4jTestContainer with AttemptValues with Logging with MockFactory {
  override type Containers = Neo4jContainer
  var neo4jTestService: Neo4jTestService = _

  override def startContainers(): Containers = {
    val neo4jContainer = getNeo4jContainer()

    neo4jTestService = new Neo4jTestService(neo4jContainer.container.getBoltUrl)

    neo4jContainer
  }

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
    val manifest = Neo4jManifest.setupManifest(neo4jTestService.neo4jDriver, global, neo4jTestService.neo4jQueryLoggingConfig).toOption.get

    val index = stub[Index]
    val pages = stub[Pages]

    val annotations = stub[Annotations]

    val users = Neo4jUserManagement(neo4jTestService.neo4jDriver, global, neo4jTestService.neo4jQueryLoggingConfig, manifest, index, pages, annotations)
  }
}
