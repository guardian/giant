package controllers.api

import com.dimafeng.testcontainers.lifecycle.and
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import com.dimafeng.testcontainers.{ElasticsearchContainer, Neo4jContainer}
import model.annotations.{Workspace, WorkspaceEntry}
import model.frontend.{TreeEntry, TreeLeaf, TreeNode}
import org.apache.pekko.util.Timeout
import org.scalatest._
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.time.{Millis, Seconds, Span}
import play.api.test.Helpers.status
import test.integration.Helpers._
import test.integration._

import java.util.concurrent.TimeUnit
import scala.concurrent.ExecutionContext

class WorkspacesITest extends AnyFunSuite
  with TestContainersForAll
  with ElasticSearchTestContainer
  with Neo4jTestContainer
  with BeforeAndAfterEach
  with BeforeAndAfterAll
  with OptionValues
  with Inside {

  final implicit override def patience: PatienceConfig = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  final implicit def executionContext: ExecutionContext = ExecutionContext.global

  final implicit val timeout: Timeout = Timeout(10, TimeUnit.SECONDS)

  var paulWorkspace: MinimalWorkspace = _
  var itemIds: ItemIds = _
  implicit var userControllers: Map[String, Controllers] = _
  var elasticsearchTestService: ElasticsearchTestService = _
  var neo4jTestService: Neo4jTestService = _

  override type Containers = Neo4jContainer and ElasticsearchContainer

  override def startContainers(): Containers = {
    val elasticContainer = getElasticSearchContainer()
    val neo4jContainer = getNeo4jContainer()
    val url = s"http://${elasticContainer.container.getHttpHostAddress}"

    elasticsearchTestService = new ElasticsearchTestService(url)
    neo4jTestService = new Neo4jTestService(neo4jContainer.container.getBoltUrl)

    // We keep all the instance vars inside the test class,
    // so that Helpers can be an immutable object of functions.
    // I think this means that if we did try and run the tests in parallel by
    // extending ParallelTestExecution, scalatest's trick of creating one instance
    // per test (http://doc.scalatest.org/3.0.1-2.12/org/scalatest/OneInstancePerTest.html)
    // would work to isolate mutable variables between tests.
    // Whereas with instance vars inside the Helpers library, I suspect they
    // would've ended up shared between test instances (since it's a static object, not
    // instantiated each time WorkspaceITest is instantiated).
    userControllers = setupUserControllers(
      usernames = Set("paul", "barry", "jimmy"),
      neo4jTestService.neo4jDriver,
      elasticsearch = elasticsearchTestService
    )

    neo4jContainer and elasticContainer
  }

//  override def beforeAll(): Unit = {
//    super.beforeAll()
//
//    // We keep all the instance vars inside the test class,
//    // so that Helpers can be an immutable object of functions.
//    // I think this means that if we did try and run the tests in parallel by
//    // extending ParallelTestExecution, scalatest's trick of creating one instance
//    // per test (http://doc.scalatest.org/3.0.1-2.12/org/scalatest/OneInstancePerTest.html)
//    // would work to isolate mutable variables between tests.
//    // Whereas with instance vars inside the Helpers library, I suspect they
//    // would've ended up shared between test instances (since it's a static object, not
//    // instantiated each time WorkspaceITest is instantiated).
//    userControllers = setupUserControllers(
//      usernames = Set("paul", "barry", "jimmy"),
//      neo4jDriver,
//      elasticsearch = this
//    )
//  }

  override def afterAll(): Unit = {
    super.afterAll()
  }

  override def beforeEach(): Unit = {
    super.beforeEach()

    neo4jTestService.deleteAllNeo4jNodes()
    elasticsearchTestService.resetIndices()

    asUser("paul") { implicit controllers =>
      paulWorkspace = createWorkspace("paul-workspace", isPublic = false)

      createIngestion(
        collectionName = "e2e-test-paul",
        ingestionName = "source"
      )

      itemIds = buildTree("e2e-test-paul", "source", paulWorkspace)
    }
  }

  private def assertUnchangedFolderF(f: TreeEntry[WorkspaceEntry]): Assertion = {
    insideNode(f) { node =>
      node.name should be("f")
      node.id should be(itemIds.f)
      node.data.addedBy.username should be("paul")
      node.children.length should be(4)

      // We use a mixture of names and ids to look up nodes,
      // to verify that both those things are working correctly.
      // .value fails the test if the result is a None
      val `f/1.txt` = node.children.find(_.name == "f-1.txt").value
      val `f/2.txt` = node.children.find(_.id == itemIds.`f/2.txt`.nodeId).value
      `f/1.txt` shouldBe a[TreeLeaf[_]]
      `f/2.txt` shouldBe a[TreeLeaf[_]]
      val `f/g` = node.children.find(_.name == "f/g").value
      val `f/h` = node.children.find(_.id == itemIds.`f/h`).value

      insideNode(`f/g`) { node =>
        node.data.maybeParentId should contain(itemIds.f)
        node.children.length should be(2)
        node.children.exists(_.name == "f-g-1.txt") should be(true)
        node.children.exists(_.name == "f-g-2.txt") should be(true)
      }
      insideNode(`f/h`) { node =>
        node.data.maybeParentId should contain(itemIds.f)
        node.children.length should be(1)
        node.children.exists(_.name == "f-h-1.txt") should be(true)
      }
    }
  }

  private def assertUnchangedPaulWorkspace(paulWorkspace: Workspace): Assertion = {
    paulWorkspace.id should be(paulWorkspace.id)
    insideNode(paulWorkspace.rootNode) { node =>
      node.name should be("paul-workspace")
      node.children.length should be(2)
      val `1.txt` = node.children.find(_.name == "root-1.txt").value
      `1.txt` shouldBe a[TreeLeaf[_]]
      val f = node.children.find(_.name == "f").value
      assertUnchangedFolderF(f)
    }
  }

  test("is paulWorkspace set up as expected") {
    asUser("paul") { implicit controllers =>
      var paulWorkspaceFromApi = getWorkspace(paulWorkspace.id)
      assertUnchangedPaulWorkspace(paulWorkspaceFromApi)

      // Add another folder to check it gets cleared out between tests
      createWorkspaceFolderAssertingSuccess(
        workspaceId = paulWorkspace.id,
        parentNodeId = paulWorkspace.rootNodeId,
        name = "g"
      )
      paulWorkspaceFromApi = getWorkspace(paulWorkspace.id)

      insideChildren(paulWorkspaceFromApi.rootNode) { children =>
        children.exists(_.name == "g") should be(true)
      }
    }
  }

  test("we're back to the initial state after adding folder g") {
    asUser("paul") { implicit controllers =>
      val paulWorkspaceFromApi = getWorkspace(paulWorkspace.id)
      insideChildren(paulWorkspaceFromApi.rootNode) { children =>
        children.exists(_.name == "g") should be(false)
      }
    }
  }

  test("moving folder f between two of paul's workspaces") {
    asUser("paul") { implicit controllers =>
      searchExact("f-1.txt", paulWorkspace.id).hits should be(1)

      val paulWorkspaceTwo = createWorkspace("paul-workspace-2", isPublic = false)
      searchExact("f-1.txt", paulWorkspaceTwo.id).hits should be(0)

      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.f,
        // if no new parent id, it assumes root node
        newWorkspaceId = Some(paulWorkspaceTwo.id)
      )

      insideNode(getWorkspace(paulWorkspaceTwo.id).rootNode) { node =>
        node.name should be("paul-workspace-2")
        node.children.length should be(1)
        val f = node.children.find(_.name == "f").value
        assertUnchangedFolderF(f)
      }
      searchExact("f-1.txt", paulWorkspaceTwo.id).hits should be(1)

      insideNode(getWorkspace(paulWorkspace.id).rootNode) { node =>
        node.name should be("paul-workspace")
        node.children.exists(_.name == "root-1.txt") should be(true)
        node.children.exists(_.name == "f") should be(false)
        node.children.length should be(1)
      }
      searchExact("f-1.txt", paulWorkspace.id).hits should be(0)

      val newFolderInPaulWorkspaceRoot = createWorkspaceFolderAssertingSuccess(
        workspaceId = paulWorkspace.id,
        parentNodeId = paulWorkspace.rootNodeId,
        name = "new"
      )

      // move back, to non-root
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspaceTwo.id,
        itemId = itemIds.f,
        newParentId = Some(newFolderInPaulWorkspaceRoot),
        newWorkspaceId = Some(paulWorkspace.id)
      )

      insideNode(getWorkspace(paulWorkspace.id).rootNode) { node =>
        node.name should be("paul-workspace")
        node.children.length should be(2)

        insideChildren(node.children.find(_.name == "new").value) { children =>
          assertUnchangedFolderF(children.find(_.name == "f").value)
        }
      }
      searchExact("f-1.txt", paulWorkspace.id).hits should be(1)

      insideNode(getWorkspace(paulWorkspaceTwo.id).rootNode) { node =>
        node.name should be("paul-workspace-2")
        node.id should be(paulWorkspaceTwo.rootNodeId)
        node.children.length should be(0)
      }
      searchExact("f-1.txt", paulWorkspaceTwo.id).hits should be(0)
    }
  }

  test("moving between paul's workspace and jimmy's workspaces") {
    val jimmyWorkspace = asUser("jimmy") { implicit controller =>
      val workspace = createWorkspace("jimmy", isPublic = true)
      searchExact("f-g-1.txt", workspace.id).hits should be(0)
      workspace
    }

    asUser("paul") { implicit controllers =>
      searchExact("f-g-1.txt", paulWorkspace.id).hits should be(1)

      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.f,
        newWorkspaceId = Some(jimmyWorkspace.id)
      )
      searchExact("f-g-1.txt", paulWorkspace.id).hits should be(0)

      insideNode(getWorkspace(jimmyWorkspace.id).rootNode) { node =>
        node.id should be(jimmyWorkspace.rootNodeId)
        node.children.length should be(1)
        val f = node.children.find(_.name == "f").value
        assertUnchangedFolderF(f)
      }
      searchExact("f-g-1.txt", jimmyWorkspace.id).hits should be(1)
    }

    asUser("jimmy") { implicit controller =>
      status(setWorkspaceIsPublic(jimmyWorkspace.id, isPublic = false)) should be(204)
      getWorkspace(jimmyWorkspace.id).isPublic should be(false)
    }

    asUser("paul") { implicit controllers =>
      // Jimmy's workspace is no longer public so Paul cannot move into it
      status(moveWorkspaceItem(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`1.txt`.nodeId,
        newWorkspaceId = Some(jimmyWorkspace.id)
      )) should be(404)

      // or search in it.
      searchExact("f-g-1.txt", jimmyWorkspace.id).hits should be(0)
    }

    asUser("jimmy") { implicit controller =>
      status(setWorkspaceFollowers(jimmyWorkspace.id, List("paul"))) should be(204)
    }

    asUser("paul") { implicit controllers =>
      // Paul is now following Jimmy's workspace so he should be able to search in it
      searchExact("f-g-1.txt", jimmyWorkspace.id).hits should be(1)

      // And move into it
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`1.txt`.nodeId,
        newWorkspaceId = Some(jimmyWorkspace.id)
      )

      insideNode(getWorkspace(jimmyWorkspace.id).rootNode) { node =>
        node.children.length should be(2)
        node.children.find(_.name == "root-1.txt") shouldBe defined
      }
      searchExact("root-1.txt", jimmyWorkspace.id).hits should be(1)

      // and move back from it into his workspace
      moveWorkspaceItemAssertingSuccess(
        workspaceId = jimmyWorkspace.id,
        itemId = itemIds.`1.txt`.nodeId,
        newWorkspaceId = Some(paulWorkspace.id)
      )

      insideNode(getWorkspace(paulWorkspace.id).rootNode) { node =>
        node.children.find(_.name == "root-1.txt") shouldBe defined
      }
      searchExact("root-1.txt", paulWorkspace.id).hits should be(1)
    }

    asUser("jimmy") { implicit controller =>
      status(setWorkspaceFollowers(jimmyWorkspace.id, List())) should be(204)
    }

    asUser("paul") { implicit controllers =>
      // Jimmy's workspace is no longer shared with Paul so he cannot move into it
      status(moveWorkspaceItem(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`1.txt`.nodeId,
        newWorkspaceId = Some(jimmyWorkspace.id)
      )) should be(404)

      // or search in it
      searchExact("root-1.txt", jimmyWorkspace.id).hits should be(0)

      // Paul also cannot move things out of Jimmy's workspace
      status(moveWorkspaceItem(
        workspaceId = jimmyWorkspace.id,
        itemId = itemIds.f,
        newWorkspaceId = Some(paulWorkspace.id)
      )) should be(404)
    }
  }


  test("moving things within the same workspace") {
    asUser("paul") { implicit controllers =>
      // move file into sibling folder: moving f/g/2.txt into f/h
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f/g/2.txt`.nodeId,
        // if no newWorkspaceId, it assumes same workspace
        newParentId = Some(itemIds.`f/h`)
      )
      insideChildren(getWorkspace(paulWorkspace.id).rootNode) { children =>
        insideChildren(children.find(_.name == "f").value) { children =>
          insideChildren(children.find(_.name == "f/h").value) { children =>
            children.length should be(2)
            val `f/g/2.txt` = children.find(_.id == itemIds.`f/g/2.txt`.nodeId).value
            `f/g/2.txt`.data.maybeParentId should contain(itemIds.`f/h`)
          }
          insideChildren(children.find(_.name == "f/g").value) { children =>
            children.length should be(1)
            children.exists(_.id == itemIds.`f/g/2.txt`.nodeId) should be(false)
          }
        }
      }

      // move file into ancestor: moving f/g/1.txt into f
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f/g/1.txt`.nodeId,
        newParentId = Some(itemIds.`f`),
      )
      insideChildren(getWorkspace(paulWorkspace.id).rootNode) { children =>
        insideChildren(children.find(_.name == "f").value) { children =>
          children.exists(_.id == itemIds.`f/g/1.txt`.nodeId) should be(true)
          insideChildren(children.find(_.name == "f/g").value) { children =>
            children.length should be(0)
          }
        }
      }

      // move folder into ancestor: moving f/g into root of workspace
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f/g`,
        newParentId = Some(paulWorkspace.rootNodeId),
      )
      insideChildren(getWorkspace(paulWorkspace.id).rootNode) { children =>
        children.exists(_.id == itemIds.`f/g`) should be(true)
        insideChildren(children.find(_.name == "f").value) { children =>
          children.exists(_.id == itemIds.`f/g`) should be(false)
        }
      }

      // move file into root: moving files remaining in f into root of workspace
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f/1.txt`.nodeId,
        newParentId = Some(paulWorkspace.rootNodeId),
      )
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f/2.txt`.nodeId,
        newParentId = Some(paulWorkspace.rootNodeId),
      )
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        // this one we moved out of g above
        itemId = itemIds.`f/g/1.txt`.nodeId,
        newParentId = Some(paulWorkspace.rootNodeId),
      )
      insideChildren(getWorkspace(paulWorkspace.id).rootNode) { children =>
        children.map(_.name) should contain theSameElementsAs (List(
          "root-1.txt",
          "f-1.txt",
          "f-2.txt",
          "f-g-1.txt",
          "f/g",
          "f"
        ))
        insideChildren(children.find(_.id == itemIds.`f`).value) { children =>
          children.map(_.name) should contain theSameElementsAs List("f/h")
        }
      }
    }
  }

  // Grouped together for efficiency, because these require no reset between them
  test("moving things that should be no-ops") {
    asUser("paul") { implicit controllers =>
      // f/g/1.txt to its current location
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f/g/1.txt`.nodeId,
        newParentId = Some(itemIds.`f/g`),
      )
      assertUnchangedPaulWorkspace(getWorkspace(paulWorkspace.id))

      // 1.txt to its current location
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`1.txt`.nodeId,
        newParentId = Some(paulWorkspace.rootNodeId),
      )
      assertUnchangedPaulWorkspace(getWorkspace(paulWorkspace.id))

      // f/g to its current location
      moveWorkspaceItemAssertingSuccess(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f/g`,
        newParentId = Some(itemIds.`f`),
      )
      assertUnchangedPaulWorkspace(getWorkspace(paulWorkspace.id))

      // f into f/g (an item into its descendant)
      status(moveWorkspaceItem(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f`,
        newParentId = Some(itemIds.`f/g`),
      )) should be(404)
      assertUnchangedPaulWorkspace(getWorkspace(paulWorkspace.id))

      // root node into f (an item into its descendant)
      status(moveWorkspaceItem(
        workspaceId = paulWorkspace.id,
        itemId = paulWorkspace.rootNodeId,
        newParentId = Some(itemIds.f),
      )) should be(404)
      assertUnchangedPaulWorkspace(getWorkspace(paulWorkspace.id))
    }

    // moving folder f from paul's workspace to jimmy's workspace
    val jimmyWorkspace = asUser("jimmy") { implicit controllers =>
      createWorkspace("jimmy-workspace", isPublic = false)
    }
    asUser("paul") { implicit controllers =>
      status(moveWorkspaceItem(
        workspaceId = paulWorkspace.id,
        itemId = itemIds.`f`,
        newWorkspaceId = Some(jimmyWorkspace.id)
      )) should be(404)
      assertUnchangedPaulWorkspace(getWorkspace(paulWorkspace.id))
    }
    asUser("jimmy") { implicit controllers =>
      inside(getWorkspace(jimmyWorkspace.id).rootNode) {
        case TreeNode(id, name, data, children) => children.length should be(0)
      }
    }

    // moving a workspace root node between workspace
    asUser("paul") { implicit controllers =>
      val paulWorkspaceTwo = createWorkspace("paul-workspace-2", isPublic = false)
      status(moveWorkspaceItem(
        workspaceId = paulWorkspace.id,
        itemId = paulWorkspace.rootNodeId,
        newWorkspaceId = Some(paulWorkspaceTwo.id)
      )) should be(404)
      assertUnchangedPaulWorkspace(getWorkspace(paulWorkspace.id))
    }

    // moving without supplying either a new parent or a new workspace
    asUser("paul") { implicit controllers =>
      // this one is 400 (Bad Request) rather than 404 because we're not hiding any
      // sensitive information about workspace existence, it's simply that the
      // endpoint has been called incorrectly
      status(moveWorkspaceItem(
        workspaceId = paulWorkspace.id,
        itemId = paulWorkspace.rootNodeId,
      )) should be(400)
      assertUnchangedPaulWorkspace(getWorkspace(paulWorkspace.id))
    }
  }

  test("Paul can rename his workspace") {
    asUser("paul") { implicit controllers =>

      status(setWorkspaceName(
        workspaceId = paulWorkspace.id,
        name = "paul-workspace-renamed"
      )) should be(204)

      val paulWorkspaceFromApi = getWorkspace(paulWorkspace.id)
      insideNode(paulWorkspaceFromApi.rootNode) { node =>
        node.name should be("paul-workspace-renamed")
      }
      paulWorkspaceFromApi.name should be("paul-workspace-renamed")
    }
  }

  test("Creating a folder inside different kinds of workspace") {
    asUser("paul") { implicit controllers =>
      val insidePrivate = createWorkspaceFolderAssertingSuccess(
        workspaceId = paulWorkspace.id,
        parentNodeId = paulWorkspace.rootNodeId,
        name = "insidePrivate"
      )

      status(setWorkspaceIsPublic(
        workspaceId = paulWorkspace.id,
        isPublic = true
      )) should be(204)

      val insidePublic = createWorkspaceFolderAssertingSuccess(
        workspaceId = paulWorkspace.id,
        parentNodeId = paulWorkspace.rootNodeId,
        name = "insidePublic"
      )

      status(setWorkspaceFollowers(paulWorkspace.id, List("jimmy"))) should be(204)

      val insidePublicWithFollower = createWorkspaceFolderAssertingSuccess(
        workspaceId = paulWorkspace.id,
        parentNodeId = paulWorkspace.rootNodeId,
        name = "insidePublicWithFollower"
      )

      status(setWorkspaceFollowers(paulWorkspace.id, List("jimmy", "barry"))) should be(204)

      val insidePublicWithFollowers = createWorkspaceFolderAssertingSuccess(
        workspaceId = paulWorkspace.id,
        parentNodeId = paulWorkspace.rootNodeId,
        name = "insidePublicWithFollowers"
      )

      val paulWorkspaceFromApi = getWorkspace(paulWorkspace.id)
      insideChildren(paulWorkspaceFromApi.rootNode) { children =>
        children.map(_.id) should contain allOf(insidePrivate, insidePublic, insidePublicWithFollower, insidePublicWithFollowers)
      }
    }
  }

  test("Permissions when creating folders") {
    val jimmyWorkspace = asUser("jimmy") { implicit controller =>
      createWorkspace("jimmy", isPublic = true)
    }

    asUser("paul") { implicit controllers =>
      createWorkspaceFolderAssertingSuccess(
        workspaceId = jimmyWorkspace.id,
        parentNodeId = jimmyWorkspace.rootNodeId,
        name = "f"
      )
    }

    asUser("jimmy") { implicit controller =>
      status(setWorkspaceIsPublic(jimmyWorkspace.id, isPublic = false)) should be(204)
      getWorkspace(jimmyWorkspace.id).isPublic should be(false)
    }

    asUser("paul") { implicit controllers =>
      // Jimmy's workspace is no longer public so Paul cannot create a folder in it
      status(createWorkspaceFolder(
        workspaceId = jimmyWorkspace.id,
        parentNodeId = jimmyWorkspace.rootNodeId,
        name = "g"
      )) should be(404)
    }

    asUser("jimmy") { implicit controller =>
      status(setWorkspaceFollowers(jimmyWorkspace.id, List("paul"))) should be(204)
    }

    asUser("paul") { implicit controllers =>
      // Paul is now following Jimmy's workspace so he should be able to create a folder in it
      createWorkspaceFolderAssertingSuccess(
        workspaceId = jimmyWorkspace.id,
        parentNodeId = jimmyWorkspace.rootNodeId,
        name = "h"
      )
    }

    asUser("jimmy") { implicit controller =>
      status(setWorkspaceFollowers(jimmyWorkspace.id, List())) should be(204)
    }

    asUser("paul") { implicit controllers =>
      // Jimmy's workspace is no longer shared with Paul so he cannot create a folder in it
      status(createWorkspaceFolder(
        workspaceId = jimmyWorkspace.id,
        parentNodeId = jimmyWorkspace.rootNodeId,
        name = "i"
      )) should be(404)
    }
  }
}
