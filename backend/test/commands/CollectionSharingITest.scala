package commands

import java.util.concurrent.TimeUnit

import akka.util.Timeout
import model.Uri
import model.manifest.{Blob, Collection}
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.time.{Millis, Seconds, Span}
import play.api.libs.json.Json
import play.api.test.FakeRequest
import play.api.test.Helpers.{await, contentAsJson, status}
import test.integration.Helpers._
import test.integration.{ElasticsearchTestService, Neo4jTestService}

import scala.concurrent.ExecutionContext

class CollectionSharingITest extends AnyFunSuite with Neo4jTestService with ElasticsearchTestService {
  final implicit override def patience: PatienceConfig = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  final implicit def executionContext: ExecutionContext = ExecutionContext.global

  final implicit val timeout: Timeout = Timeout(10, TimeUnit.SECONDS)

  implicit var userControllers: Map[String, Controllers] = _
  var paulsBlob: Blob = _
  var paulsBlobWithinDirectory: Blob = _

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

  test("Paul creates a collection and uploads a file") {
    asUser("paul") { implicit controllers =>
      // Check that ingestion doesn't exist yet
      getNonBlobResourceStatus("e2e-test-paul/source") should be(404)
      // Check that file doesn't exist yet
      getNonBlobResourceStatus("e2e-test-paul/source/paul.txt") should be(404)

      createIngestion(
        collectionName = "e2e-test-paul",
        ingestionName = "source"
      )

      paulsBlob = uploadFileToIngestionAssertingSuccess(
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "paul.txt",
        fileContents = "This is test content from Paul",
      )

      // Check that ingestion is visible
      getNonBlobResourceStatus("e2e-test-paul/source") should be(200)
      // Check that file is visible
      getNonBlobResourceStatus("e2e-test-paul/source/paul.txt") should be(200)
      // Check that blob is visible
      getBlobResourceStatus(paulsBlob.uri.value) should be(200)

      getCollectionFilters() should contain only("e2e-test-paul")
    }

    asUser("barry") { implicit controllers =>
      getCollectionFilters() shouldBe empty
    }
  }

  test("Paul creates a file within a directory") {
    asUser("paul") { implicit controllers =>
      // Check that directory doesn't exist yet
      getNonBlobResourceStatus("e2e-test-paul/source/directory") should be(404)
      // Check that file doesn't exist yet
      getNonBlobResourceStatus("e2e-test-paul/source/directory/paul.txt") should be(404)

      paulsBlobWithinDirectory = uploadFileToIngestionAssertingSuccess(
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "directory/paul.txt",
        fileContents = "This is test content from Paul",
      )

      // Check that directory is visible
      getNonBlobResourceStatus("e2e-test-paul/source/directory") should be(200)
      // Check that file is visible
      getNonBlobResourceStatus("e2e-test-paul/source/directory/paul.txt") should be(200)
      // Check that blob is visible
      getBlobResourceStatus(paulsBlobWithinDirectory.uri.value) should be(200)

      getCollectionFilters() should contain only("e2e-test-paul")
    }
  }

  test("Barry creates a collection and uploads a file") {
    asUser("barry") { implicit controllers =>
      createIngestion(
        collectionName = "e2e-test-barry",
        ingestionName = "source")

      val blob = uploadFileToIngestionAssertingSuccess(
        collectionName = "e2e-test-barry",
        ingestionName = "source",
        filename = "barry.txt",
        fileContents = "This is test content from Barry",
      )

      getBlobResourceStatus(blob.uri.value) should be(200)

      getCollectionFilters() should contain only("e2e-test-barry")
    }

    asUser("paul") { implicit controllers =>
      getCollectionFilters() should contain only("e2e-test-paul")
    }
  }

  test("Paul and Barry cannot see each others collection") {
    asUser("paul") { implicit controllers =>
      listCollections() should contain only "e2e-test-paul"
      status(controllers.collections.getCollection(Uri("e2e-test-barry")).apply(FakeRequest())) should be(404)
    }

    asUser("barry") { implicit controllers =>
      listCollections() should contain only "e2e-test-barry"
      status(controllers.collections.getCollection(Uri("e2e-test-paul")).apply(FakeRequest())) should be(404)
    }
  }

  test("Admin can see Paul and Barry's collections") {
    asUser("admin") { implicit controllers =>
      listCollections() should contain only("e2e-test-paul", "e2e-test-barry")

      val paulsCollection = getCollection("e2e-test-paul")
      paulsCollection.uri should be(Uri("e2e-test-paul"))
      paulsCollection.users should contain only("paul")

      val barrysCollection = getCollection("e2e-test-barry")
      barrysCollection.uri should be(Uri("e2e-test-barry"))
      barrysCollection.users should contain only("barry")
    }
  }

  test("Paul cannot upload a file to Barry's collection") {
    asUser("paul") { implicit controllers =>
      status(uploadFileToIngestion(
        collectionName = "e2e-test-barry",
        ingestionName = "source",
        filename = "paul.txt",
        fileContents = "This is Paul's test content that should be rejected",
      )) should be(404)
    }
  }

  test("Users cannot upload files to collections that don't exist") {
    asUser("barry") { implicit controllers =>
      status(uploadFileToIngestion(
        collectionName = "e2e-test-doesnt-exist",
        ingestionName = "source",
        filename = "barry.txt",
        fileContents = "This is Barry's test content that should be rejected",
      )) should be(404)
    }
  }

  test("Paul (not an admin) cannot share collections with users") {
    asUser("paul") { implicit controllers =>
      setUserCollections("paul", List("e2e-test-paul", "e2e-test-barry")) should not be(204)
      setUserCollections("barry", List("e2e-test-paul", "e2e-test-barry")) should not be(204)
      setUserCollections("admin", List("e2e-test-paul", "e2e-test-barry")) should not be(204)
    }
  }

  test("Barry can see Paul's ingestion, directory, file and blob when the collection is shared with him") {
    asUser("barry") { implicit controllers =>
      getNonBlobResourceStatus("e2e-test-paul/source") should be(404)
      getNonBlobResourceStatus("e2e-test-paul/source/paul.txt") should be(404)
      getNonBlobResourceStatus("e2e-test-paul/source/directory") should be(404)
      getNonBlobResourceStatus("e2e-test-paul/source/directory/paul.txt") should be(404)
      getBlobResourceStatus(paulsBlob.uri.value) should be(404)
    }

    asUser("admin") { implicit controllers =>
      setUserCollections("barry", List("e2e-test-paul", "e2e-test-barry")) should be(204)
    }

    asUser("barry") { implicit controllers =>
      getNonBlobResourceStatus("e2e-test-paul/source") should be(200)
      getNonBlobResourceStatus("e2e-test-paul/source/paul.txt") should be(200)
      getNonBlobResourceStatus("e2e-test-paul/source/directory") should be(200)
      getNonBlobResourceStatus("e2e-test-paul/source/directory/paul.txt") should be(200)
      getBlobResourceStatus(paulsBlob.uri.value) should be(200)

      getCollectionFilters() should contain only("e2e-test-barry", "e2e-test-paul")

      val paulsCollection = getCollection("e2e-test-paul")
      paulsCollection.uri should be(Uri("e2e-test-paul"))
      paulsCollection.users should contain only("barry", "paul")
    }
  }

  test("Barry can no longer see Paul's ingestion, directory, file and blob if the collection is no longer shared with him") {
    asUser("barry") { implicit controllers =>
      getNonBlobResourceStatus("e2e-test-paul/source") should be(200)
      getNonBlobResourceStatus("e2e-test-paul/source/paul.txt") should be(200)
      getNonBlobResourceStatus("e2e-test-paul/source/directory") should be(200)
      getNonBlobResourceStatus("e2e-test-paul/source/directory/paul.txt") should be(200)
      getBlobResourceStatus(paulsBlob.uri.value) should be(200)
    }

    asUser("admin") { implicit controllers =>
      setUserCollections("barry", List("e2e-test-barry")) should be(204)
    }

    asUser("barry") { implicit controllers =>
      getNonBlobResourceStatus("e2e-test-paul/source") should be(404)
      getNonBlobResourceStatus("e2e-test-paul/source/paul.txt") should be(404)
      getNonBlobResourceStatus("e2e-test-paul/source/directory") should be(404)
      getNonBlobResourceStatus("e2e-test-paul/source/directory/paul.txt") should be(404)
      getBlobResourceStatus(paulsBlob.uri.value) should be(404)

      getCollectionFilters() should contain only("e2e-test-barry")

      status(controllers.collections.getCollection(Uri("e2e-test-paul")).apply(FakeRequest())) should be(404)
    }
  }

  test("Paul and Barry can see the same file if they have both uploaded it, even without sharing their collections") {
    var paulsBlobId = ""
    var barrysBlobId = ""

    asUser("paul") { implicit controllers =>
      paulsBlobId = uploadFileToIngestionAssertingSuccess(
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "shared.paul.txt",
        fileContents = "This is shared test content"
      ).uri.value
    }

    asUser("barry") { implicit controllers =>
      barrysBlobId = uploadFileToIngestionAssertingSuccess(
        collectionName = "e2e-test-barry",
        ingestionName = "source",
        filename = "shared.barry.txt",
        fileContents = "This is shared test content"
      ).uri.value
    }

    paulsBlobId should be(barrysBlobId)

    asUser("paul") { implicit controllers =>
      getBlobResourceStatus(paulsBlobId) should be(200)
      // but he cannot see Barry's file which points to the same blob
      getNonBlobResourceStatus("e2e-test-barry/source/shared.barry.txt") should be(404)
    }

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulsBlobId) should be(200)
      // but he cannot see Paul's file which points to the same blob
      getNonBlobResourceStatus("e2e-test-paul/source/shared.paul.txt") should be(404)
    }

    asUser("jimmy") { implicit controllers =>
      getBlobResourceStatus(paulsBlobId) should be(404)
    }
  }

  test("Barry can see a file that has been shared with them through Jimmy's collection, even though Paul has not shared his collection with him") {
    var paulsBlobId = ""
    var jimmysBlobId = ""

    asUser("paul") { implicit controllers =>
      paulsBlobId = uploadFileToIngestionAssertingSuccess(
        collectionName = "e2e-test-paul",
        ingestionName = "source",
        filename = "more.shared.paul.txt",
        fileContents = "This is more shared test content"
      ).uri.value
    }

    asUser("jimmy") { implicit controllers =>
      createIngestion(
        collectionName = "e2e-test-jimmy",
        ingestionName = "source"
      )

      jimmysBlobId = uploadFileToIngestionAssertingSuccess(
        collectionName = "e2e-test-jimmy",
        ingestionName = "source",
        filename = "more.shared.jimmy.txt",
        fileContents = "This is more shared test content"
      ).uri.value
    }

    paulsBlobId should be(jimmysBlobId)

    asUser("paul") { implicit controllers =>
      // Paul can access the file path via his collection
      getNonBlobResourceStatus("e2e-test-paul/source/more.shared.paul.txt") should be(200)

      // Paul can access the blob
      getBlobResourceStatus(paulsBlobId) should be(200)

      // But Paul cannot access the file path via Jimmy's collection
      getNonBlobResourceStatus("e2e-test-jimmy/source/more.shared.jimmy.txt") should be(404)
    }

    asUser("barry") { implicit controllers =>
      // Barry cannot access the file path via Paul's collection
      getNonBlobResourceStatus("e2e-test-paul/source/more.shared.paul.txt") should be(404)

      // Barry cannot access the blob
      getBlobResourceStatus(paulsBlobId) should be(404)

      // Barry cannot access the file path via Jimmy's collection
      getNonBlobResourceStatus("e2e-test-jimmy/source/more.shared.jimmy.txt") should be(404)
    }

    asUser("jimmy") { implicit controllers =>
      // Jimmy can access the file path via his collection
      getNonBlobResourceStatus("e2e-test-jimmy/source/more.shared.jimmy.txt") should be(200)

      // Jimmy can access the blob
      getBlobResourceStatus(paulsBlobId) should be(200)

      // But Jimmy cannot access the file path via Paul's collection
      getNonBlobResourceStatus("e2e-test-paul/source/more.shared.paul.txt") should be(404)
    }

    asUser("admin") { implicit controllers =>
      setUserCollections("barry", List("e2e-test-jimmy", "e2e-test-barry")) should be(204)
    }

    asUser("barry") { implicit controllers =>
      // Barry can access the file path via Jimmy's collection
      getNonBlobResourceStatus("e2e-test-jimmy/source/more.shared.jimmy.txt") should be(200)

      // Barry can access the blob
      getBlobResourceStatus(paulsBlobId) should be(200)

      // But Barry cannot access the file path via Paul's collection
      getNonBlobResourceStatus("e2e-test-paul/source/more.shared.paul.txt") should be(404)

      getCollectionFilters() should contain only("e2e-test-barry", "e2e-test-jimmy")
    }

    asUser("admin") { implicit controllers =>
      setUserCollections("barry", List("e2e-test-barry")) should be(204)
    }

    asUser("barry") { implicit controllers =>
      getBlobResourceStatus(paulsBlobId) should be(404)
      getCollectionFilters() should contain only "e2e-test-barry"
    }
  }

  // TODO MRB: un-ignore once we update all collections transactionally in neo4j
  ignore("Changing shared collections in rapid succession does not lead to inconsistency") {
    asUser("admin") { implicit controllers =>
      List("one", "two", "three").foreach { postfix =>
        createIngestion(
          collectionName = s"e2e-test-rapid-${postfix}",
          ingestionName = "source"
        )
      }

      status(controllers.collections.setUserCollections("jimmy").apply(FakeRequest()
        .withBody(Json.toJson(List("e2e-test-rapid-one"))))) should be(204)

      // Execute the two requests below as close to "in parallel" as possible
      val futureFirstResponse = controllers.collections.setUserCollections("jimmy").apply(FakeRequest()
        .withBody(Json.toJson(List("e2e-test-rapid-one", "e2e-test-rapid-two", "e2e-test-rapid-three"))))

      val futureSecondResponse = controllers.collections.setUserCollections("jimmy").apply(FakeRequest()
        .withBody(Json.toJson(List("e2e-test-rapid-two"))))

      await(futureFirstResponse)
      await(futureSecondResponse)

      val collections = contentAsJson(controllers.collections.listCollections().apply(FakeRequest())).as[List[Collection]]
      val uris = collections.map(_.uri.value)

      uris should contain only("e2e-test-rapid-two")
    }
  }

  private def getCollectionFilters()(implicit controllers: Controllers, timeout: Timeout): List[String] = {
    val filters = getFilters()

    filters.find(_.key == "ingestion") match {
      case Some(filters) =>
        filters.options.map(_.value)

      case None =>
        List.empty
    }
  }
}
