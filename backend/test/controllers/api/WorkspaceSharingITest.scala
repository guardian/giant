package controllers.api

import java.util.concurrent.TimeUnit

import akka.util.Timeout
import org.scalatest.time.{Millis, Seconds, Span}
import org.scalatest.BeforeAndAfterEach
import model.frontend.user.PartialUser
import play.api.test.Helpers.status
import test.integration.Helpers._
import test.integration.{ElasticsearchTestService, Neo4jTestService}

import scala.concurrent.{Await, ExecutionContext, Future}
import org.scalatest.funsuite.AnyFunSuite

class WorkspaceSharingITest extends AnyFunSuite with Neo4jTestService with ElasticsearchTestService with BeforeAndAfterEach {
  final implicit override def patience: PatienceConfig = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  final implicit def executionContext: ExecutionContext = ExecutionContext.global

  final implicit val timeout: Timeout = Timeout(10, TimeUnit.SECONDS)

  implicit var userControllers: Map[String, Controllers] = _
  var paulWorkspace: MinimalWorkspace = _
  var barryWorkspace: MinimalWorkspace = _

  private def uploadAndAddFileToWorkspaceAsPaul(): BlobAndNodeId = {
    asUser("paul") { implicit controllers =>
      val paulWorkspaceFromApi = getWorkspace(paulWorkspace.id)

      uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "paul.txt",
        fileContents = "This is Paul's test content",
        workspaceId = paulWorkspaceFromApi.id,
        parentNodeId = paulWorkspaceFromApi.rootNode.id,
        workspaceName = paulWorkspaceFromApi.name
      )
    }
  }

  override def beforeAll(): Unit = {
    super.beforeAll()

    userControllers = setupUserControllers(
      usernames = Set("paul", "barry", "jimmy"),
      neo4jDriver,
      elasticsearch = this
    )
  }

  override def beforeEach(): Unit = {
    super.beforeEach()

    deleteAllNeo4jNodes()
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
    }

    asUser("barry") { implicit controllers =>
      createIngestion(
        collectionName = "e2e-test-barry",
        ingestionName = "source"
      )

      barryWorkspace = createWorkspace(
        workspaceName = "test",
        isPublic = false
      )
    }
  }

  test("Paul adds a new entry to the workspace and then removes it") {
    asUser("paul") { implicit controllers =>
      val paulWorkspaceFromApi = getWorkspace(paulWorkspace.id)

      val blobAndNodeId = uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "paul.txt",
        fileContents = "This is Paul's test content",
        workspaceId = paulWorkspaceFromApi.id,
        parentNodeId = paulWorkspaceFromApi.rootNode.id,
        workspaceName = paulWorkspaceFromApi.name
      )

      insideChildren(getWorkspace(paulWorkspace.id).rootNode) { children =>
        children.length should be(1)
      }

      removeFileFromWorkspaceAssertingSuccess(
        workspaceId = paulWorkspaceFromApi.id,
        itemId = blobAndNodeId.nodeId
      )

      insideChildren(getWorkspace(paulWorkspace.id).rootNode) { children =>
        children.length should be(0)
      }
    }
  }

  test("Paul and Barry cannot see each others files simply because they have created a workspace (#585)") {
    val paulBlobAndNodeId = uploadAndAddFileToWorkspaceAsPaul()

    val barryBlobAndNodeId = asUser("barry") { implicit controllers =>
      val barryWorkspaceFromApi = getWorkspace(barryWorkspace.id)

      val barryBlobAndNodeId = uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-test-barry",
        ingestionName = "source",
        filename = "barry.txt",
        fileContents = "This is Barry's test content",
        workspaceId = barryWorkspaceFromApi.id,
        parentNodeId = barryWorkspaceFromApi.rootNode.id,
        workspaceName = barryWorkspaceFromApi.name
      )

      getBlobResourceStatus(barryBlobAndNodeId.blobId) should be(200)
      getBlobResourceStatus(paulBlobAndNodeId.blobId) should be(404)

      barryBlobAndNodeId
    }

    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(paulBlobAndNodeId.blobId) should be(200)
      getBlobResourceStatus(barryBlobAndNodeId.blobId) should be(404)
    }
  }

  test("Paul and Barry cannot see each others workspace") {
    asUser("paul") { implicit controllers =>
      val paulWorkspaces = getAllWorkspaces()
      paulWorkspaces.length should be(1)
      paulWorkspaces exists(_.id == paulWorkspace.id) should be(true)
    }
    asUser("barry") { implicit controllers =>
      val barryWorkspaces = getAllWorkspaces()
      barryWorkspaces.length should be(1)
      barryWorkspaces exists(_.id == barryWorkspace.id) should be(true)
    }
  }

  test("Paul cannot add a file to Barrys workspaces") {
    asUser("paul") { implicit controllers =>
      val paulBlobAndNodeId = uploadAndAddFileToWorkspaceAsPaul()

      // TODO MRB: Currently a 500, should be a 400?
      status(addFileToWorkspace(
        workspaceId = barryWorkspace.id,
        parentNodeId = barryWorkspace.rootNodeId,
        blobId = paulBlobAndNodeId.blobId,
        name = "test"
      )) should be(500)
    }
  }

//  // TODO MRB: Un-ignore and fix. We need to check we can access a blob before adding it to a workspace!!
//  // https://trello.com/c/yYBpEBEV/773-enforce-access-permissions-when-adding-a-file-to-a-workspace
//  ignore("Barry cannot add Pauls file to his workspace") {
//    val (barrysWorkspaceId, barrysWorkspace) = state.users("barry").workspaceByName("test")
//    val paulsBlobId = state.users("paul").files("paul.txt")
//
//    state.addFileToWorkspace("barry", barrysWorkspaceId, barrysWorkspace.rootNodeId, paulsBlobId) should not be(200)
//
//    state.getResource("barry", paulsBlobId) should be(404)
//  }

  test("Barry cannot remove a file from Pauls workspace") {
    val paulBlobAndNodeId = uploadAndAddFileToWorkspaceAsPaul()

    asUser("barry") { implicit controllers =>
      // TODO MRB: Currently a 500, should be a 404?
      status(removeFileFromWorkspace(
        workspaceId = paulWorkspace.id,
        itemId = paulBlobAndNodeId.nodeId
      )) should be(500)
    }
  }

  test("Barry cannot delete a file from Pauls workspace") {
    val paulBlobAndNodeId = uploadAndAddFileToWorkspaceAsPaul()

    asUser("barry") { implicit controllers =>
      status(deleteFileFromWorkspace(
        workspaceId = paulWorkspace.id,
        blobUri = paulBlobAndNodeId.blobId
      )) should be(500)
    }
  }

  test("Barry cannot rename a file in Pauls workspace") {
    val paulBlobAndNodeId = uploadAndAddFileToWorkspaceAsPaul()

    asUser("barry") { implicit controllers =>
      // TODO MRB: Currently a 500, should be a 404?
      status(renameWorkspaceItem(
        workspaceId = paulWorkspace.id,
        itemId = paulBlobAndNodeId.nodeId,
        itemName = "whatever"
      )) should be(500)
    }
  }

  test("Barry cannot share Paul's workspace with Jimmy") {
    asUser("barry") { implicit controllers =>
      // TODO JS: Currently a 500, should be a 404?
      status(setWorkspaceFollowers(
          workspaceId = paulWorkspace.id,
          followers = List("jimmy")
      )) should be(500)
    }
  }

  test("Barry cannot delete Paul's workspace") {
    asUser("barry") { implicit controllers =>
      // TODO MRB: currently a 500, should be a 404?
      status(deleteWorkspace(paulWorkspace.id)) should be(500)
    }
  }

  test("Users cannot add files to workspaces that don't exist") {
    asUser("paul") { implicit controllers =>
      val paulBlobId = uploadAndAddFileToWorkspaceAsPaul().blobId

      // TODO MRB: Currently a 500, should be a 400?
      status(addFileToWorkspace(
        workspaceId = "not-real",
        parentNodeId = "it's a fake",
        blobId = paulBlobId,
        name = "ain't gonna work"
      )) should be(500)
    }
  }

  test("Barry can see files in Paul's workspace but only Paul shares it with him") {
    val paulBlobId = asUser("paul") { implicit controllers =>
      val blobId = uploadAndAddFileToWorkspaceAsPaul().blobId
      status(setWorkspaceFollowers(paulWorkspace.id, List("barry"))) should be(204)
      blobId
    }

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulBlobId) should be(200)
      getFilters().exists(_.options.exists(_.value == paulWorkspace.id)) should be(true)
      getAllWorkspaces().length should be(2)
    }

    // Barry can see an additional file uploaded directly to Paul's workspace
    val paulBlobTwoId = asUser("paul") { implicit controllers =>
      val blobId = uploadAndAddFileToWorkspaceAsPaul().blobId
      getBlobResourceStatus(blobId) should be(200)
      blobId
    }
    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulBlobTwoId) should be(200)
    }

    // Barry can no longer see Paul's files if the workspace is no longer shared with him
    asUser("paul") { implicit controllers =>
      status(setWorkspaceFollowers(paulWorkspace.id, List())) should be(204)
    }
    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulBlobId) should be(404)
      getBlobResourceStatus(paulBlobTwoId) should be(404)
      getFilters().exists(_.options.exists(_.value == paulWorkspace.id)) should be(false)
      getAllWorkspaces().length should be(1)
    }

    // Barry cannot now see any additional files directly to Paul's workspace
    val paulBlobThreeId = asUser("paul") { implicit controllers =>
      val blobId = uploadAndAddFileToWorkspaceAsPaul().blobId
      getBlobResourceStatus(paulBlobTwoId) should be(200)
      blobId
    }
    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulBlobThreeId) should be(404)
    }
  }

  test("Barry can see and edit Paul's public workspace contents, but not the workspace itself") {
    val paulPublicWorkspace = asUser("paul") { implicit controllers =>
      val publicWorkspace = createWorkspace(
        workspaceName = "test-public",
        isPublic = true
      )
      uploadFileToWorkspaceAssertingSuccess(
        workspaceId = publicWorkspace.id,
        parentNodeId = publicWorkspace.rootNodeId,
        workspaceName = "test-public",
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "paul-public.txt",
        fileContents = "This is Paul's test content"
      )
      publicWorkspace
    }

    asUser("barry") { implicit controllers =>
      getFilters().exists(_.options.exists(_.value == paulPublicWorkspace.id)) should be(true)
      getAllWorkspaces().exists(_.id == paulPublicWorkspace.id) should be(true)

      uploadFileToWorkspaceAssertingSuccess(
        workspaceId = paulPublicWorkspace.id,
        parentNodeId = paulPublicWorkspace.rootNodeId,
        workspaceName = "test-public",
        // note that we're uploading to Barry's collection/ingestion,
        // but adding to Paul's workspace
        collectionName = "e2e-test-barry",
        ingestionName = "source",
        filename = "barry-public.txt",
        fileContents = "This is Barry's workspace test content in Paul's public workspace"
      )

      // TODO MRB: currently a 500, should be a 404?
      status(deleteWorkspace(paulPublicWorkspace.id)) should be(500)
    }

    asUser("paul") { implicit controllers =>
      status(deleteWorkspace(paulPublicWorkspace.id)) should be(204)
    }
  }


//
//  // TODO MRB: fix and un-ignore this test (https://trello.com/c/qBatWjgj/781-enforce-access-permissions-when-uploading-files-using-the-cli)
//  ignore("Users cannot upload files to workspaces that don't exist") {
//    intercept {
//      state = state.uploadFileToWorkspace(
//        user = "paul",
//        collectionName = "e2e-test-paul",
//        ingestionName = "source",
//        filename = "paul.other.txt",
//        fileContents = "Here is some more content from Paul",
//        workspaceId = "it's not a real workspace id",
//        workspaceRootNodeId = "really it's not real",
//        workspaceName = "it doesn't matter! It's not real"
//      )
//    }
//  }
//


//  // TODO MRB: this should check they cannot see each others datasets in the parent information
  test("Barry and Paul can see the same file if they have both uploaded it, even without sharing their workspaces") {
    val paulBlobId = asUser("paul") { implicit controllers =>
      uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "shared.txt",
        fileContents = "Here is some shared content",
        workspaceId = paulWorkspace.id,
        parentNodeId = paulWorkspace.rootNodeId,
        workspaceName = "test"
      ).blobId
    }

    val barryBlobId = asUser("barry") { implicit controllers =>
      uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-test-barry",
        ingestionName = "source",
        filename = "shared.txt",
        fileContents = "Here is some shared content",
        workspaceId = barryWorkspace.id,
        parentNodeId = barryWorkspace.rootNodeId,
        workspaceName = "test"
      ).blobId
    }

    // Check blob IDs are the same
    paulBlobId should be(barryBlobId)

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulBlobId) should be(200)
    }

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(barryBlobId) should be(200)
    }
  }

  test("Jimmy can share a workspace with both Paul and Barry") {
    val (jimmyBlobAndNodeId, jimmyWorkspace) = asUser("jimmy") { implicit controllers =>
      createIngestion(
        collectionName = "e2e-test-jimmy",
        ingestionName = "source"
      )

      val workspace = createWorkspace(
        workspaceName = "test",
        isPublic = false
      )

      val blobAndNodeId = uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-test-jimmy",
        ingestionName = "source",
        filename = "shared-with-paul-and-barry.txt",
        fileContents = "Now I am partying with the Chuckle Brothers",
        workspaceId = workspace.id,
        parentNodeId = workspace.rootNodeId,
        workspaceName = "test"
      )

      status(setWorkspaceFollowers(workspace.id, List("barry", "paul"))) should be(204)

      (blobAndNodeId, workspace)
    }

    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(jimmyBlobAndNodeId.blobId) should be(200)
    }

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(jimmyBlobAndNodeId.blobId) should be(200)
    }

    // Once unshared, Paul and Barry should not be able to see Jimmy's file
    asUser("jimmy") { implicit controllers =>
      status(setWorkspaceFollowers(jimmyWorkspace.id, List())) should be(204)
    }

    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(jimmyBlobAndNodeId.blobId) should be(404)
    }

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(jimmyBlobAndNodeId.blobId) should be(404)
    }
  }

  test("Barry can see a file that has been shared with them by Jimmy, even though Paul has stopped sharing it with them") {
    val (jimmyWorkspace, jimmyBlobAndNodeId) = asUser("jimmy") { implicit controllers =>
      createIngestion(
        collectionName = "e2e-test-jimmy",
        ingestionName = "source"
      )

      val workspace = createWorkspace(
        workspaceName = "test",
        isPublic = false
      )

      val blobAndNodeId = uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-test-jimmy",
        ingestionName = "source",
        filename = "common-to-jimmy-and-paul.txt",
        fileContents = "common to jimmy and paul",
        workspaceId = workspace.id,
        parentNodeId = workspace.rootNodeId,
        workspaceName = "test"
      )

      status(setWorkspaceFollowers(workspace.id, List("barry"))) should be(204)

      (workspace, blobAndNodeId)
    }

    val paulBlobAndNodeId = asUser("paul") { implicit controllers =>
      val blobAndNodeId = uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "common-to-jimmy-and-paul.txt",
        fileContents = "common to jimmy and paul",
        workspaceId = paulWorkspace.id,
        parentNodeId = paulWorkspace.rootNodeId,
        workspaceName = "test"
      )

      status(setWorkspaceFollowers(paulWorkspace.id, List("barry"))) should be(204)

      blobAndNodeId
    }

    // Check blob IDs are the same
    paulBlobAndNodeId.blobId should be(jimmyBlobAndNodeId.blobId)

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulBlobAndNodeId.blobId) should be(200)
    }

    asUser("paul") { implicit controllers =>
      status(setWorkspaceFollowers(paulWorkspace.id, List())) should be(204)
    }

    // Jimmy is still sharing it with him at this point
    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulBlobAndNodeId.blobId) should be(200)
    }

    asUser("jimmy") { implicit controllers =>
      status(setWorkspaceFollowers(jimmyWorkspace.id, List())) should be(204)
    }

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulBlobAndNodeId.blobId) should be(404)
    }
  }

  // This test fails because neo4j uses read-committed isolation
  // https://neo4j.com/docs/java-reference/current/transaction-management/isolation/index.html
  // and because we have to read the current workspace followers so we can remove them and set the new ones.
  // If another transaction is in progress that would modify followers, the subsequent
  // transaction sees stale data and inconsistencies result.
  // We could fix this by denormalising and setting followers as an array
  // directly on the workspace.
  ignore("Updating workspace followers in rapid succession does not lead to inconsistency") {
    asUser("paul") { implicit controllers =>
      // paul is the creator so he comes back as one of the followers
      getWorkspace(paulWorkspace.id).followers should be(List(PartialUser("paul", "paul")))

      val futures = Future.sequence(List(
        setWorkspaceFollowers(paulWorkspace.id, List("barry")),
        setWorkspaceFollowers(paulWorkspace.id, List("barry", "jimmy")),
        setWorkspaceFollowers(paulWorkspace.id, List())
      ))

      Await.result(futures, timeout.duration).map(_.header.status) should contain only 204
      getWorkspace(paulWorkspace.id).followers should be(List(PartialUser("paul", "paul")))
    }
  }

  test("Paul can delete his workspace but Barry cannot") {
    asUser("barry") { implicit controllers =>
      // TODO: JS: should be 404
      status(deleteWorkspace(paulWorkspace.id)) should be(500)
      getAllWorkspaces().length should be(1)
    }

    asUser("paul") { implicit controllers =>
      status(deleteWorkspace(paulWorkspace.id)) should be(204)
      getAllWorkspaces().length should be(0)
    }
  }

  test("Barry cannot rename Paul's public workspace") {
    val paulPublicWorkspace = asUser("paul") { implicit controllers =>
      val publicWorkspace = createWorkspace(
        workspaceName = "test-public",
        isPublic = true
      )
      publicWorkspace

    }

    asUser("barry") { implicit controllers =>
      // TODO Currently a 500, should be a 404?
      status(setWorkspaceName(
        workspaceId = paulPublicWorkspace.id,
        name = "barry-edit"
      )) should be (500)
    }
  }

  test("Barry cannot set Paul's public workspace to private") {
    val paulPublicWorkspace = asUser("paul") { implicit controllers =>
      val publicWorkspace = createWorkspace(
        workspaceName = "test-public",
        isPublic = true
      )
      publicWorkspace
    }
    asUser("barry") { implicit controllers =>
      // TODO Currently a 500, should be a 404?
      status(setWorkspaceIsPublic(
        workspaceId = paulPublicWorkspace.id,
        isPublic = false
      )) should be (500)
    }
  }

}
