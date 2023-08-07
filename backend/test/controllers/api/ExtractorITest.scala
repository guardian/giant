package controllers.api

import java.nio.file.Files
import java.util.concurrent.TimeUnit

import akka.util.Timeout
import extraction.ExtractionParams
import extraction.archives.ZipExtractor
import model.ingestion.WorkspaceItemContext
import model.{English, Uri}
import model.manifest.{Blob, MimeType}
import org.scalatest.BeforeAndAfterEach
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.time.{Millis, Seconds, Span}
import play.api.test.Helpers.status
import services.ScratchSpace
import test.integration.Helpers.{BlobAndNodeId, Controllers, asUser, createIngestion, createWorkspace, getBlobResourceStatus, getNonBlobResourceStatus, getResourceStatus, setUserCollections, setWorkspaceFollowers, setupUserControllers, uploadFileToWorkspaceAssertingSuccess}
import test.integration.{ElasticsearchTestService, Neo4jTestService}

import scala.concurrent.ExecutionContext

class ExtractorITest extends AnyFunSuite with Neo4jTestService with ElasticsearchTestService with BeforeAndAfterEach {
  final implicit override def patience: PatienceConfig = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  final implicit def executionContext: ExecutionContext = ExecutionContext.global

  final implicit val timeout: Timeout = Timeout(10, TimeUnit.SECONDS)

  implicit var userControllers: Map[String, Controllers] = _
  var jimmyZipBlobAndNodeId: BlobAndNodeId = _

  override def beforeAll(): Unit = {
    super.beforeAll()

    userControllers = setupUserControllers(
      usernames = Set("paul", "barry", "jimmy", "admin"),
      neo4jDriver,
      elasticsearch = this,
      admins = Set("admin")
    )
  }

  // *****************
  // *** IMPORTANT ***
  // *****************
  //
  // These tests run one after the other and depend on the result of the previous tests!
  // This means you CANNOT run a single test in isolation and expect it to pass.

  test("Folders and files within a zip file can be viewed if shared through a workspace") {
    // Jimmy uploads ZIP via upload controller endpoint,
    // and adds it to a workspace.
    val (jimmyWorkspace, zipBlobAndNodeId) = asUser("jimmy") { implicit controllers =>
      createIngestion(
        collectionName = "e2e-extractor-test-jimmy",
        ingestionName = "source"
      )
      val workspace = createWorkspace(
        workspaceName = "test-extractor",
        isPublic = false
      )
      val blobAndNodeId = uploadFileToWorkspaceAssertingSuccess(
        collectionName = "e2e-extractor-test-jimmy",
        ingestionName = "source",
        filename = "ingestme.zip",
        fileContents = "CHANGE ME not actually used because extractors do not run",
        workspaceId = workspace.id,
        parentNodeId = workspace.rootNodeId,
        workspaceName = workspace.name
      )

      (workspace, blobAndNodeId)
    }
    jimmyZipBlobAndNodeId = zipBlobAndNodeId

    // Call ZipExtractor to extract folders from ZIP
    // (extractors don't run automatically in an integration test)
    val scratchFolder = Files.createTempDirectory("scratch")
    val scratchSpace = new ScratchSpace(scratchFolder)
    val blob = Blob(new Uri(zipBlobAndNodeId.blobId), 123L, Set(MimeType("application/zip")))
    val inputStream = this.getClass.getClassLoader.getResourceAsStream("ingestme.zip")
    val zipExtractor = new ZipExtractor(scratchSpace, userControllers("jimmy").ingestionServices)
    val extractionParams = ExtractionParams(
      ingestion = "source",
      languages = List(English),
      parentBlobs = List(),
      workspace = Some(WorkspaceItemContext(jimmyWorkspace.id, jimmyWorkspace.rootNodeId, zipBlobAndNodeId.blobId))
    )
    zipExtractor.extract(blob, inputStream, extractionParams)

    // Paul should not be able to see the top-level ZIP blob,
    // or the files and folders within it.
    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(s"${zipBlobAndNodeId.blobId}") should be(404)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/Georgia_opposition_NATO-Eng-F.doc") should be(404)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/directory") should be(404)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/directory/shared.txt") should be(404)
    }

    // Jimmy shares workspace with Paul
    asUser("jimmy") { implicit controllers =>
      status(setWorkspaceFollowers(jimmyWorkspace.id, List("paul"))) should be(204)
    }

    // Paul should be able to see both the top-level ZIP blob,
    // and also the files and folders within it.
    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(s"${zipBlobAndNodeId.blobId}") should be(200)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/directory") should be(200)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/Georgia_opposition_NATO-Eng-F.doc") should be(200)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/directory/shared.txt") should be(200)
    }

    // Jimmy un-shares workspace with Paul
    asUser("jimmy") { implicit controllers =>
      status(setWorkspaceFollowers(jimmyWorkspace.id, List())) should be(204)
    }

    // Paul should not be able to see the top-level ZIP blob,
    // or the files and folders within it.
    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(s"${zipBlobAndNodeId.blobId}") should be(404)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/Georgia_opposition_NATO-Eng-F.doc") should be(404)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/directory") should be(404)
      getNonBlobResourceStatus(s"${zipBlobAndNodeId.blobId}/ingestme/directory/shared.txt") should be(404)
    }
  }

  test("Folders and files within a zip file can be viewed if shared through a collection") {
    asUser("admin") { implicit controllers =>
      setUserCollections("paul", List("e2e-extractor-test-jimmy")) should be(204)
    }

    // Paul should be able to see both the top-level ZIP blob,
    // and also the files and folders within it.
    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(s"${jimmyZipBlobAndNodeId.blobId}") should be(200)
      getNonBlobResourceStatus(s"${jimmyZipBlobAndNodeId.blobId}/ingestme/Georgia_opposition_NATO-Eng-F.doc") should be(200)
      getNonBlobResourceStatus(s"${jimmyZipBlobAndNodeId.blobId}/ingestme/directory") should be(200)
      getNonBlobResourceStatus(s"${jimmyZipBlobAndNodeId.blobId}/ingestme/directory/shared.txt") should be(200)
    }

    asUser("admin") { implicit controllers =>
      setUserCollections("paul", List()) should be(204)
    }

    // Paul should not be able to see the top-level ZIP blob,
    // or the files and folders within it.
    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(s"${jimmyZipBlobAndNodeId.blobId}") should be(404)
      getNonBlobResourceStatus(s"${jimmyZipBlobAndNodeId.blobId}/ingestme/Georgia_opposition_NATO-Eng-F.doc") should be(404)
      getNonBlobResourceStatus(s"${jimmyZipBlobAndNodeId.blobId}/ingestme/directory") should be(404)
      getNonBlobResourceStatus(s"${jimmyZipBlobAndNodeId.blobId}/ingestme/directory/shared.txt") should be(404)
    }
  }
}
