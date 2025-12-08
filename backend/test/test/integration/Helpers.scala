package test.integration

import software.amazon.awssdk.services.sns.SnsClient
import org.apache.pekko.util.Timeout
import commands.IngestFileResult
import controllers.api._
import extraction.MimeTypeMapper
import model.annotations.{Workspace, WorkspaceEntry, WorkspaceMetadata}
import model.frontend.{Filter, SearchResults, TreeEntry, TreeNode}
import model.manifest.{Blob, Collection, CollectionWithUsers}
import model.user.UserPermissions
import model.{CreateCollectionRequest, CreateIngestionRequest, English, Uri}
import org.neo4j.driver.v1.Driver
import org.scalatest.matchers.should.Matchers
import org.scalatest.{Assertion, Inside, OptionValues}
import play.api.libs.Files.SingletonTemporaryFileCreator
import play.api.libs.json.Json
import play.api.mvc.Result
import play.api.test.FakeRequest
import play.api.test.Helpers.{contentAsJson, contentAsString, status, stubControllerComponents => playStubControllerComponents}
import services.annotations.Neo4jAnnotations
import services.ingestion.{IngestionServices, Neo4jRemoteIngestStore}
import services.manifest.Neo4jManifest
import services.users.{Neo4jUserManagement, UserManagement}
import services.{BucketConfig, Neo4jQueryLoggingConfig, NoOpMetricsService, RemoteIngestConfig, S3Config, TestTypeDetector}
import test.integration.Helpers.BlobAndNodeId
import test.{TestAuthActionBuilder, TestIngestStorage, TestObjectStorage, TestPostgresClient, TestPreviewService, TestUserManagement}
import utils.Logging
import utils.attempt.AttemptAwait._
import utils.auth.User
import utils.controller.{AuthControllerComponents, DefaultFailureToResultMapper}

import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.util.UUID
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}

case class ItemIds(
  `1.txt`: BlobAndNodeId,
  f: String,
  `f/1.txt`: BlobAndNodeId,
  `f/2.txt`: BlobAndNodeId,
  `f/g`: String,
  `f/g/1.txt`: BlobAndNodeId,
  `f/g/2.txt`: BlobAndNodeId,
  `f/h`: String,
  `f/h/1.txt`: BlobAndNodeId
)

object Helpers extends Matchers with Logging with OptionValues with Inside {

  var userControllers: Map[String, Controllers] = _

  case class MinimalWorkspace(id: String, rootNodeId: String, name: String)
  case class BlobAndNodeId(blobId: String, nodeId: String)
  class Controllers(
    val collections: Collections,
    val resource: Resource,
    val filters: Filters,
    val workspace: Workspaces,
    val search: Search,
    val documents: Documents,
    val previews: Previews,
    val ingestionServices: IngestionServices
  )

  def searchExact(phrase: String, workspaceId: String, workspaceFolderId: Option[String] = None)(implicit controllers: Controllers, timeout: Timeout): SearchResults = {
    val urlEncodedQuery = URLEncoder.encode(s"""["\\"${phrase}\\""]""", "UTF-8")

    val request = workspaceFolderId.fold {
      FakeRequest("GET", s"""/query?q=$urlEncodedQuery&workspace[]=${workspaceId}""")
    } { folderId =>
      FakeRequest("GET", s"""/query?q=$urlEncodedQuery&workspaceId=${workspaceId}&workspaceFolderId=${folderId}""")
    }

    contentAsJson(controllers.search.search().apply(request)).as[SearchResults]
  }

  def addFileToWorkspace(workspaceId: String, parentNodeId: String, blobId: String, name: String)(implicit controllers: Controllers, timeout: Timeout): Future[Result] = {
    controllers.workspace.addItemToWorkspace(workspaceId)
      .apply(FakeRequest().withBody(Json.toJson(
        AddItemData(name, parentNodeId, "file", Some("icon"), AddItemParameters(uri = Some(blobId), size = None, mimeType = None)))))
  }

  def renameWorkspaceItem(workspaceId: String, itemId: String, itemName: String)(implicit controllers: Controllers, timeout: Timeout): Future[Result] = {
    controllers.workspace.renameItem(workspaceId, itemId).apply(
      FakeRequest().withBody(Json.toJson(RenameItemData(itemName))))
  }

  def getFullResource(blobId: String)(implicit controllers: Controllers, timeout: Timeout): model.frontend.Resource = {
    contentAsJson(controllers.resource.getResource(Uri(blobId), basic = false, q = None)
      .apply(FakeRequest())).as[model.frontend.Resource]
  }

  def getBlobResourceStatus(blobId: String)(implicit controllers: Controllers, timeout: Timeout): Int = {
    getResourceStatus(blobId, basic = false)
  }

  def getNonBlobResourceStatus(resourceId:  String)(implicit controllers: Controllers, timeout: Timeout): Int = {
    getResourceStatus(resourceId, basic = true)
  }

  def getResourceStatus(resourceId: String, basic: Boolean)(implicit controllers: Controllers, timeout: Timeout): Int = {
    val endpointToStatus = Map(
      "getResourceBasic" -> status(controllers.resource.getResource(Uri(resourceId), basic = true, q = None).apply(FakeRequest())),
      "authoriseDownload" -> status(controllers.documents.authoriseDownload(Uri(resourceId)).apply(FakeRequest())),
      "getPreviewMetadata" -> status(controllers.previews.getPreviewMetadata(Uri(resourceId)).apply(FakeRequest())),
      "generatePreview" -> status(controllers.previews.getPreviewMetadata(Uri(resourceId)).apply(FakeRequest())),
      "getPreview" -> status(controllers.previews.getPreview(Uri(resourceId)).apply(FakeRequest())),
      "authorisePreviewDownload" -> status(controllers.previews.authoriseDownload(Uri(resourceId)).apply(FakeRequest()))
    ) ++ (if(!basic) {
      Map("getResourceFull" -> status(controllers.resource.getResource(Uri(resourceId), basic = false, q = None).apply(FakeRequest())))
    } else {
      Map.empty
    })

    val statusesInconsistent = endpointToStatus.values.toSet.size != 1

    if(statusesInconsistent) {
      fail(s"Inconsistent result across getResource endpoints: ${endpointToStatus}")
    }

    endpointToStatus("getResourceBasic")
  }

  def removeFileFromWorkspace(workspaceId: String, itemId: String)(implicit controllers: Controllers, timeout: Timeout): Future[Result] = {
    controllers.workspace.removeItem(workspaceId, itemId)
      .apply(FakeRequest())
  }

  def deleteFileFromWorkspace(workspaceId: String, blobUri: String)(implicit controllers: Controllers, timeout: Timeout): Future[Result] = {
    controllers.workspace.deleteBlob(workspaceId, blobUri)
      .apply(FakeRequest())
  }

  def removeFileFromWorkspaceAssertingSuccess(workspaceId: String, itemId: String)(implicit controllers: Controllers, timeout: Timeout): Assertion = {
    val responseCode = status(removeFileFromWorkspace(workspaceId, itemId))
    responseCode should be(204)
  }

  def deleteWorkspace(workspaceId: String)(implicit controllers: Controllers, timeout: Timeout): Future[Result] = {
    controllers.workspace.deleteWorkspace(workspaceId).apply(FakeRequest())
  }

  def uploadFileToIngestion(
    collectionName: String,
    ingestionName: String,
    filename: String,
    fileContents: String
  )(implicit controllers: Controllers, timeout: Timeout): Future[Result] = {
    // Play doesn't seem to write the body automatically to a temporary file when running with the testing stubs
    val tempFile = SingletonTemporaryFileCreator.create()
    Files.write(tempFile.path, fileContents.getBytes(StandardCharsets.UTF_8))

    val headers = Seq(
      "Content-Location" -> filename,
      "X-PFI-Upload-Id" -> UUID.randomUUID().toString
    )

    controllers.collections.uploadIngestionFile(collectionName, ingestionName).apply(
      FakeRequest()
        .withHeaders(headers: _*)
        .withBody(tempFile)
    )
  }

  def uploadFileToIngestionAssertingSuccess(
    collectionName: String,
    ingestionName: String,
    filename: String,
    fileContents: String
  )(implicit controllers: Controllers, timeout: Timeout): Blob = {
    val uploadResponse = uploadFileToIngestion(collectionName, ingestionName, filename, fileContents)

    val responseCode = status(uploadResponse)
    responseCode should be(201)

    val result = contentAsJson(uploadResponse).as[IngestFileResult]
    result.blob
  }

  def uploadFileToWorkspaceAssertingSuccess(
    collectionName: String,
    ingestionName: String,
    filename: String,
    fileContents: String,
    workspaceId: String,
    parentNodeId: String,
    workspaceName: String
  )(implicit controllers: Controllers, timeout: Timeout): BlobAndNodeId = {
    // Play doesn't seem to write the body automatically to a temporary file when running with the testing stubs
    val tempFile = SingletonTemporaryFileCreator.create()
    Files.write(tempFile.path, fileContents.getBytes(StandardCharsets.UTF_8))

    val headers = Seq(
      "Content-Location" -> filename,
      "X-PFI-Upload-Id" -> UUID.randomUUID().toString,
      "X-PFI-Workspace-Id" -> workspaceId,
      "X-PFI-Workspace-Parent-Node-Id" -> parentNodeId,
      "X-PFI-Workspace-Name" -> workspaceName
    )

    val uploadResponse = controllers.collections.uploadIngestionFile(collectionName, ingestionName).apply(
      FakeRequest()
        .withHeaders(headers: _*)
        .withBody(tempFile)
    )

    val responseCode = status(uploadResponse)
    responseCode should be(201)

    val result = contentAsJson(uploadResponse).as[IngestFileResult]
    BlobAndNodeId(result.blob.uri.value, result.workspaceNodeId.get)
  }

  def asUser[T](username: String)(f: Controllers => T)(implicit userControllers: Map[String, Controllers]): T =
    // get(username).value will fail the test if username is not in the map,
    // but without throwing an exception
    f(userControllers.get(username).value)

  def stubControllerComponentsAsUser(username: String, userManagement: UserManagement): AuthControllerComponents = {
    val controllerComponents = playStubControllerComponents()
    val authActionBuilder = new TestAuthActionBuilder(controllerComponents, User(username, username))
    val failureToResultMapper = new DefaultFailureToResultMapper

    new AuthControllerComponents(authActionBuilder, failureToResultMapper, userManagement, controllerComponents)
  }

  // Create users in DB and, for each user, set up controllers that receive all requests
  // as if from. Return a map of the usernames to the controllers.
  def setupUserControllers(usernames: Set[String], neo4jDriver: Driver, elasticsearch: ElasticsearchTestService, admins: Set[String] = Set.empty)
    (implicit ec: ExecutionContext): Map[String, Controllers] = {

    val queryLoggingConfig = new Neo4jQueryLoggingConfig(1.second, logAllQueries = false)
    val manifest = Neo4jManifest.setupManifest(neo4jDriver, ec, queryLoggingConfig).toOption.get
    val remoteIngestStore = Neo4jRemoteIngestStore.setup(neo4jDriver, ec, queryLoggingConfig).toOption.get
    val annotations = Neo4jAnnotations.setupAnnotations(neo4jDriver, ec, queryLoggingConfig).toOption.get

    val typeDetector = new TestTypeDetector("application/pdf")

    val ingestionServices = IngestionServices(manifest, elasticsearch.elasticResources, new TestObjectStorage(), typeDetector, new MimeTypeMapper(), new TestPostgresClient)

    elasticsearch.resetIndices()

    val s3Config = S3Config("fake", BucketConfig("fake", "fake", "fake", "fake", "fake", "fake"), None, None, None, None)
    val mediaDownloadConfig = RemoteIngestConfig("", "", "")
    val snsClient = SnsClient.builder().build()
    val downloadExpiryPeriod = 1.minute

    val userManagement = Neo4jUserManagement(neo4jDriver, ec, queryLoggingConfig, manifest, elasticsearch.elasticResources, elasticsearch.elasticPages, annotations)

    usernames.map { username =>
      val user = TestUserManagement.user(username).dbUser
      val permissions = if(admins.contains(username)) { UserPermissions.bigBoss } else { UserPermissions.default }
      userManagement.createUser(user, permissions).await()

      val controllerComponents = stubControllerComponentsAsUser(username, userManagement)
      val collectionsController = new Collections(controllerComponents, manifest, userManagement, elasticsearch.elasticResources, s3Config, elasticsearch.elasticEvents, elasticsearch.elasticPages, ingestionServices, annotations)
      val resourceController = new Resource(controllerComponents, manifest, elasticsearch.elasticResources, elasticsearch.elasticPages,  annotations, null)
      val filtersController = new Filters(controllerComponents, manifest, annotations)
      val workspaceController = new Workspaces(controllerComponents, annotations, elasticsearch.elasticResources, manifest, userManagement, new TestObjectStorage(), new TestObjectStorage(), new TestPostgresClient(), remoteIngestStore, new TestIngestStorage(), mediaDownloadConfig, snsClient)
      val metricsService = new NoOpMetricsService()
      val searchController = new Search(controllerComponents, userManagement, elasticsearch.elasticResources, annotations, metricsService)
      val documentsController = new Documents(controllerComponents, manifest, elasticsearch.elasticResources, null, userManagement, annotations, downloadExpiryPeriod)
      val previewsController = new Previews(controllerComponents, manifest, elasticsearch.elasticResources, new TestPreviewService, userManagement, annotations, downloadExpiryPeriod)

      username -> new Controllers(
        collectionsController,
        resourceController,
        filtersController,
        workspaceController,
        searchController,
        documentsController,
        previewsController,
        ingestionServices
      )
    }.toMap
  }

  def createWorkspace(workspaceName: String, isPublic: Boolean)(implicit controllers: Controllers, timeout: Timeout): MinimalWorkspace = {
    val createResponse =  controllers.workspace.create
      .apply(FakeRequest().withBody(Json.toJson(CreateWorkspaceData(workspaceName, isPublic, "hot-pink"))))

    val responseCode = status(createResponse)
    responseCode should be(201)

    val workspaceId = contentAsString(createResponse)

    val workspaceJson = contentAsJson(controllers.workspace.getContents(workspaceId).apply(FakeRequest()))
    val workspaceRootNodeId = (workspaceJson \ "id").as[String]

    MinimalWorkspace(workspaceId, workspaceRootNodeId, workspaceName)
  }

  def createIngestion(collectionName: String, ingestionName: String)(implicit controllers: Controllers, timeout: Timeout): Assertion = {
    // There's a tempting method called withJsonBody but don't use it because it passes the wrong request type to Play!
    // https://github.com/playframework/playframework/issues/7877
    status(controllers.collections.newCollection().apply(
      FakeRequest().withBody(Json.toJson(CreateCollectionRequest(collectionName))))) should be(201)

    val createIngestionRequest = CreateIngestionRequest(
      path = None,
      name = Some(ingestionName), // server will pick
      languages = List(English.key),
      fixed = Some(false),
      default = Some(false)
    )

    val responseCode = status(controllers.collections.newIngestion(Uri(collectionName)).apply(
      FakeRequest().withBody(Json.toJson(createIngestionRequest))))

    responseCode should be(200)
  }

  def createWorkspaceFolder(workspaceId: String, parentNodeId: String, name: String)(implicit controllers: Controllers, timeout: Timeout): Future[Result] = {
    controllers.workspace.addItemToWorkspace(workspaceId)
      .apply(FakeRequest().withBody(Json.toJson(
        AddItemData(
          name = name,
          parentId = parentNodeId,
          `type` =  "folder",
          icon = None,
          AddItemParameters(uri = None, size = None, mimeType = None)
        )
      )))
  }

  def createWorkspaceFolderAssertingSuccess(workspaceId: String, parentNodeId: String, name: String)(implicit controllers: Controllers, timeout: Timeout): String = {
    val addResponse = createWorkspaceFolder(workspaceId, parentNodeId, name)

    status(addResponse) should be(201)

    val json = contentAsJson(addResponse)
    (json \ "id").as[String]
  }

  def moveWorkspaceItem(workspaceId: String, itemId: String, newParentId: Option[String] = None, newWorkspaceId: Option[String] = None)(implicit controllers: Controllers, timeout: Timeout): Future[Result] =
    controllers.workspace.moveItem(workspaceId, itemId)
      .apply(FakeRequest().withBody(Json.toJson(
        MoveCopyDestination(
          newParentId = newParentId,
          newWorkspaceId = newWorkspaceId
        )
      )))

  def moveWorkspaceItemAssertingSuccess(workspaceId: String, itemId: String, newParentId: Option[String] = None, newWorkspaceId: Option[String] = None)(implicit controllers: Controllers, timeout: Timeout): Assertion = {
    val moveResponse = moveWorkspaceItem(
      workspaceId = workspaceId,
      itemId = itemId,
      newParentId = newParentId,
      newWorkspaceId = newWorkspaceId
    )

    status(moveResponse) should be(204)
  }

  def setWorkspaceFollowers(workspaceId: String, followers: List[String])(implicit timeout: Timeout, controllers: Controllers): Future[Result] = {
    controllers.workspace.updateWorkspaceFollowers(workspaceId)
      .apply(FakeRequest().withBody(Json.toJson(UpdateWorkspaceFollowers(followers))))
  }

  def setWorkspaceIsPublic(workspaceId: String, isPublic: Boolean)(implicit timeout: Timeout, controllers: Controllers): Future[Result] = {
    controllers.workspace.updateWorkspaceIsPublic(workspaceId)
      .apply(FakeRequest().withBody(Json.toJson(UpdateWorkspaceIsPublic(isPublic))))
  }

  def setWorkspaceName(workspaceId: String, name: String)(implicit timeout: Timeout, controllers: Controllers): Future[Result] = {
    controllers.workspace.updateWorkspaceName(workspaceId)
      .apply(FakeRequest().withBody(Json.toJson(UpdateWorkspaceName(name))))
  }

  def setWorkspaceOwner(workspaceId: String, owner: String)(implicit timeout: Timeout, controllers: Controllers): Future[Result] = {
    controllers.workspace.updateWorkspaceOwner(workspaceId)
      .apply(FakeRequest().withBody(Json.toJson(UpdateWorkspaceOwner(owner))))
  }

  def getFilters()(implicit controllers: Controllers, timeout: Timeout): List[Filter] = {
    contentAsJson(controllers.filters.getFilters().apply(FakeRequest())).as[List[Filter]]
  }

  def getWorkspace(workspaceId: String)(implicit controllers: Controllers, timeout: Timeout): Workspace = {
    contentAsJson(controllers.workspace.get(workspaceId).apply(FakeRequest())).as[Workspace]
  }

  def getAllWorkspaces()(implicit controllers: Controllers, timeout: Timeout): List[WorkspaceMetadata] = {
    val allWorkspaceJson = contentAsJson(controllers.workspace.getAll.apply(FakeRequest()))

    allWorkspaceJson.as[List[WorkspaceMetadata]]
  }

  // You could just return the children rather than have a higher-order function.
  // But this way the nesting of the function calls naturally outlines the
  // structure of the tree which helpful for readability.
  // And you also get a new scope each time so you can keep calling it "children"
  // and thanks to shadowing you'll always get the one that's relevant.
  def insideChildren(treeEntry: TreeEntry[WorkspaceEntry])(f: List[TreeEntry[WorkspaceEntry]] => Assertion): Assertion = {
    inside(treeEntry) {
      case TreeNode(_, _, _, children) => f(children)
    }
  }

  def insideNode(treeEntry: TreeEntry[WorkspaceEntry])(f: TreeNode[WorkspaceEntry] => Assertion): Assertion = {
    inside(treeEntry) {
      // have to make a copy because of type erasure
      // otherwise I could just do a type match
      // e.g. case n: TreeNode[WorkspaceEntry]
      case TreeNode(id, name, data, children) => f(TreeNode(id, name, data, children))
    }
  }

  def buildTree(collectionName: String, ingestionName: String, workspace: MinimalWorkspace)(implicit controllers: Controllers, timeout: Timeout): ItemIds = {
    val `1.txt` = uploadFileToWorkspaceAssertingSuccess(
      collectionName,
      ingestionName,
      filename = "root-1.txt",
      fileContents = "Here is some content for root-1.txt",
      workspaceId = workspace.id,
      parentNodeId = workspace.rootNodeId,
      workspaceName = "paulWorkspace"
    )

    val f = createWorkspaceFolderAssertingSuccess(
      workspaceId = workspace.id,
      parentNodeId = workspace.rootNodeId,
      name = "f"
    )

    val `f/1.txt` = uploadFileToWorkspaceAssertingSuccess(
      collectionName,
      ingestionName,
      // Use dashes for the filename so we can still be clear about what the parent folder should be when reading the
      // tests even though with a slash the server would strip the filename down to just `1.txt` because it is designed
      // to be working with full paths to files (when uploading a folder)
      filename = "f-1.txt",
      fileContents = "Here is some content for fdgffdsf f/1.txt",
      workspaceId = workspace.id,
      parentNodeId = f,
      workspaceName = workspace.name
    )

    val `f/2.txt` = uploadFileToWorkspaceAssertingSuccess(
      collectionName,
      ingestionName,
      filename = "f-2.txt",
      fileContents = "Here is some content for f/2.txt",
      workspaceId = workspace.id,
      parentNodeId = f,
      workspaceName = workspace.name
    )

    val `f/g` = createWorkspaceFolderAssertingSuccess(
      workspaceId = workspace.id,
      parentNodeId = f,
      name = "f/g"
    )

    val `f/h` = createWorkspaceFolderAssertingSuccess(
      workspaceId = workspace.id,
      parentNodeId = f,
      name = "f/h"
    )

    val `f/g/1.txt` = uploadFileToWorkspaceAssertingSuccess(
      collectionName,
      ingestionName,
      filename = "f-g-1.txt",
      fileContents = "Here is some content for f/g/1.txt",
      workspaceId = workspace.id,
      parentNodeId = `f/g`,
      workspaceName = workspace.name
    )

    val `f/g/2.txt` = uploadFileToWorkspaceAssertingSuccess(
      collectionName,
      ingestionName,
      filename = "f-g-2.txt",
      fileContents = "Here is some content for f/g/2.txt",
      workspaceId = workspace.id,
      parentNodeId = `f/g`,
      workspaceName = workspace.name
    )

    val `f/h/1.txt` = uploadFileToWorkspaceAssertingSuccess(
      collectionName,
      ingestionName,
      filename = "f-h-1.txt",
      fileContents = "Here is some content for f/h/1.txt",
      workspaceId = workspace.id,
      parentNodeId = `f/h`,
      workspaceName = workspace.name
    )

    ItemIds(
      `1.txt` = `1.txt`,
      `f` = `f`,
      `f/1.txt` = `f/1.txt`,
      `f/2.txt` = `f/2.txt`,
      `f/g` = `f/g`,
      `f/g/1.txt` = `f/g/1.txt`,
      `f/g/2.txt` = `f/g/2.txt`,
      `f/h` = `f/h`,
      `f/h/1.txt` = `f/h/1.txt`
    )
  }

  def listCollections()(implicit controllers: Controllers, timeout: Timeout): List[String] = {
    contentAsJson(controllers.collections.listCollections().apply(FakeRequest()))
      .as[List[Collection]].map(_.uri.value)
  }

  def getCollection(uri: String)(implicit controllers: Controllers, timeout: Timeout): CollectionWithUsers = {
    contentAsJson(controllers.collections.getCollection(Uri(uri)).apply(FakeRequest()))
      .as[CollectionWithUsers]
  }

  def setUserCollections(user: String, collections: List[String])(implicit controllers: Controllers, timeout: Timeout): Int = {
    status(controllers.collections.setUserCollections(user).apply(FakeRequest()
      .withBody(Json.toJson(collections))))
  }
}
