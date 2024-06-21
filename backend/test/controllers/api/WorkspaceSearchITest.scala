package controllers.api

import com.dimafeng.testcontainers.lifecycle.and
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import com.dimafeng.testcontainers.{ElasticsearchContainer, Neo4jContainer}
import model.frontend.WorkspaceFolderChip._
import model.frontend.{SearchResults, WorkspaceFolderChip}
import org.apache.pekko.util.Timeout
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.{BeforeAndAfterAll, BeforeAndAfterEach}
import play.api.libs.json._
import play.api.test.FakeRequest
import play.api.test.Helpers.{contentAsJson, status}
import test.integration.Helpers._
import test.integration._

import java.util.concurrent.TimeUnit
import scala.concurrent.ExecutionContext


class WorkspaceSearchITest extends AnyFunSuite
  with TestContainersForAll
  with BeforeAndAfterAll
  with BeforeAndAfterEach
  with ElasticSearchTestContainer
  with Neo4jTestContainer {
//  final implicit override def patience: PatienceConfig = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  final implicit val executionContext: ExecutionContext = ExecutionContext.global

  final implicit val timeout: Timeout = Timeout(10, TimeUnit.SECONDS)

  override type Containers = Neo4jContainer and ElasticsearchContainer

  implicit var userControllers: Map[String, Controllers] = _
  var paulWorkspace: MinimalWorkspace = _
  var barryWorkspace: MinimalWorkspace = _

  var itemIds: ItemIds = _

  override def startContainers(): Neo4jContainer and ElasticsearchContainer = {
    val elasticContainer = getElasticSearchContainer()
    val neo4jContainer = getNeo4jContainer()
    val url = s"http://${elasticContainer.container.getHttpHostAddress}"

    val neo4jDriver = new Neo4jTestService(neo4jContainer.container.getBoltUrl).neo4jDriver
    val elasticsearchTestService = new ElasticsearchTestService(url)

    elasticsearchTestService.resetIndices()

    userControllers = setupUserControllers(
      usernames = Set("paul", "barry"),
      neo4jDriver,
      elasticsearch = elasticsearchTestService
    )

    neo4jContainer and elasticContainer
  }

  override def afterContainersStart(containers: and[Neo4jContainer, ElasticsearchContainer]): Unit = {
    super.afterContainersStart(containers)

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
      withContainers { case _ =>
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
    }

    test("Paul can search in a folder in his workspace") {
      withContainers { case _ =>
        asUser("paul") { controllers =>
          val folderId = itemIds.`f/h`
          val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
          val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")

          val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults].results
          results should have length (1)

          results.head.uri should be(itemIds.`f/h/1.txt`.blobId)
        }
      }
    }

    test("Paul can see results from nested folders in his workspace") {
      withContainers { case _ =>
        asUser("paul") { controllers =>
          val folderId = itemIds.`f`
          val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
          val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")

          val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults].results

          results.map(_.uri) should contain only(
            itemIds.`f/1.txt`.blobId,
            itemIds.`f/2.txt`.blobId,
            itemIds.`f/g/1.txt`.blobId,
            itemIds.`f/g/2.txt`.blobId,
            itemIds.`f/h/1.txt`.blobId,
          )
        }

        asUser("paul") { controllers =>
          val folderId = itemIds.`f/g`
          val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
          val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")
          val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults].results

          results.map(_.uri) should contain only(
            itemIds.`f/g/1.txt`.blobId,
            itemIds.`f/g/2.txt`.blobId
          )
        }
      }
    }



    test("Barry can search in a folder in a public workspace from Paul") {
      withContainers { case _ =>
        asUser("paul") { implicit controllers =>
          status(setWorkspaceIsPublic(paulWorkspace.id, isPublic = true)) should be(204)
        }

        println(s"paul workspace: ${paulWorkspace.id}")
        println(s"folderId: ${itemIds.`f/h`}")
        asUser("barry") { implicit controllers =>
          val folderId = itemIds.`f/h`
          val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
          val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")

          val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults].results
          results should have length (1)

          results.head.uri should be(itemIds.`f/h/1.txt`.blobId)
        }
      }
    }

  test("Paul cannot see anything when searching an empty folder") {
    withContainers { case _ =>
      asUser("paul") { implicit controllers =>
        val folderId = itemIds.`f/h`

        removeFileFromWorkspaceAssertingSuccess(
          workspaceId = paulWorkspace.id,
          itemId = itemIds.`f/h/1.txt`.nodeId
        )

        val q = Json.toJson(WorkspaceFolderChip("workspace", "workspace_folder", paulWorkspace.id, folderId))
        val request = FakeRequest("GET", s"""/query?q=[${q},"*"]""")
        val results = contentAsJson(controllers.search.search().apply(request)).as[SearchResults]

        results.hits should be(0)
      }
    }
  }
}
