package controllers.api

import java.util.concurrent.TimeUnit
import org.apache.pekko.util.Timeout
import model.frontend.SearchResults
import org.scalatest.time.{Millis, Seconds, Span}
import org.scalatest.BeforeAndAfterEach
import play.api.test.FakeRequest
import play.api.test.Helpers.{contentAsJson}
import test.integration.Helpers._
import test.integration.{ElasticsearchTestService, ItemIds}

import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import org.scalatest.funsuite.AnyFunSuite
import model.frontend.WorkspaceFolderChip._
import model.frontend.WorkspaceFolderChip
import play.api.libs.json._
import com.dimafeng.testcontainers.scalatest.TestContainerForEach
import com.dimafeng.testcontainers.Neo4jContainer
import org.neo4j.driver.v1.{AuthTokens, Driver, GraphDatabase}
import org.testcontainers.utility.DockerImageName

class WorkspaceSearchITest extends AnyFunSuite with TestContainerForEach with ElasticsearchTestService with BeforeAndAfterEach {
  println("marji2 starting the test")
  final implicit override def patience: PatienceConfig = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  final implicit def executionContext: ExecutionContext = ExecutionContext.global

  final implicit val timeout: Timeout = Timeout(10, TimeUnit.SECONDS)
  final override val StartContainersTimeout = 40.seconds

  override val containerDef = Neo4jContainer.Def(
    dockerImageName = DockerImageName.parse("neo4j/neo4j-arm64-experimental:3.5.30")
  )

  implicit var userControllers: Map[String, Controllers] = _
  var paulWorkspace: MinimalWorkspace = _
  var barryWorkspace: MinimalWorkspace = _

  var itemIds: ItemIds = _

  println("marji3 starting the test")

  override def beforeAll(): Unit = {
    super.beforeAll()
  }

  override def beforeEach(): Unit = {
    super.beforeEach()

    resetIndices()

    asUser("paul") { implicit controllers =>
      createIngestion(
        collectionName = "e2e-test-paul",
        ingestionName = "source"
      )

      paulWorkspace = createWorkspace(
        workspaceName = "test",
        isPublic = false
      )

      itemIds = buildTree("e2e-test-paul", "source", paulWorkspace)
    }
  }

  // TODO MRB: port across workspace search tests from ElasticsearchResourcesITest


    test("Barry can't search inside a folder in Paul's workspace") {
      withContainers { container =>
        val neo4jDriver: Driver = GraphDatabase.driver(container.container.getBoltUrl, AuthTokens.none())
        userControllers = setupUserControllers(
          usernames = Set("paul", "barry"),
          neo4jDriver,
          elasticsearch = this
        )
        println("marji1 starting the test")
        asUser("barry") { controllers =>
          val folderId = itemIds.f
          val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
          val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")

          val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults]
          // TODO: This is only 0 because Barry cannot see anything at all (he has no workspaces or collections of his own).
          // If he did, it would return results from them.
          // We should fix this behaviour
          results.hits should be(0)
        }
      }
      //
      //    test("Paul can search in a folder in his workspace") {
      //      asUser("paul") { controllers =>
      //        val folderId = itemIds.`f/h`
      //        val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
      //        val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")
      //
      //        val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults].results
      //        results should have length (1)
      //
      //        results.head.uri should be(itemIds.`f/h/1.txt`.blobId)
      //      }
      //    }
      //
      //    test("Paul can see results from nested folders in his workspace") {
      //      asUser("paul") { controllers =>
      //        val folderId = itemIds.`f`
      //        val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
      //        val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")
      //
      //        val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults].results
      //
      //        results.map(_.uri) should contain only(
      //          itemIds.`f/1.txt`.blobId,
      //          itemIds.`f/2.txt`.blobId,
      //          itemIds.`f/g/1.txt`.blobId,
      //          itemIds.`f/g/2.txt`.blobId,
      //          itemIds.`f/h/1.txt`.blobId,
      //        )
      //      }
      //
      //      asUser("paul") { controllers =>
      //        val folderId = itemIds.`f/g`
      //        val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
      //        val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")
      //        val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults].results
      //
      //        results.map(_.uri) should contain only(
      //          itemIds.`f/g/1.txt`.blobId,
      //          itemIds.`f/g/2.txt`.blobId
      //        )
      //      }
      //    }
      //
      //    test("Paul cannot see anything when searching an empty folder") {
      //      asUser("paul") { implicit controllers =>
      //        val folderId = itemIds.`f/h`
      //
      //        removeFileFromWorkspaceAssertingSuccess(
      //          workspaceId = paulWorkspace.id,
      //          itemId = itemIds.`f/h/1.txt`.nodeId
      //        )
      //
      //        val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
      //        val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")
      //        val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults]
      //
      //        results.hits should be(0)
      //      }
      //    }
      //
      //    test("Barry can search in a folder in a public workspace from Paul") {
      //      asUser("paul") { implicit controllers =>
      //        status(setWorkspaceIsPublic(paulWorkspace.id, isPublic = true)) should be(204)
      //      }
      //
      //      asUser("barry") { implicit controllers =>
      //        val folderId = itemIds.`f/h`
      //        val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
      //        val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")
      //
      //        val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults].results
      //        results should have length (1)
      //
      //        results.head.uri should be(itemIds.`f/h/1.txt`.blobId)
      //      }
      //    }
    }
}
