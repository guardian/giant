package services.manifest

import java.io.InputStream
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths}
import java.time.format.DateTimeFormatter
import java.time.{OffsetDateTime, ZoneOffset}

import com.google.common.hash.Hashing
import commands.IngestFile
import extraction.{ExtractionParams, Extractor, MimeTypeMapper}
import model.frontend.email.{EmailNeighbours, Neighbour, Email => FrontendEmail}
import model.ingestion.{IngestionFile, WorkspaceItemContext}
import model.manifest.{Blob, MimeType, WorkItem}
import model.{Email, English, Recipient, Uri}
import org.scalamock.scalatest.MockFactory
import services.events.Events
import services.{FingerprintServices, ObjectStorage, Tika}
import services.index.Index
import services.ingestion.IngestionServices
import test.AttemptValues
import test.integration.Neo4jTestService
import utils.attempt.{Failure, MissingPermissionFailure, NotFoundFailure}
import utils.attempt._
import utils.Logging

import scala.concurrent.ExecutionContext.Implicits.global
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

//noinspection NameBooleanParameters
class Neo4JManifestITest extends AnyFreeSpec with Matchers with Neo4jTestService with AttemptValues with Logging with MockFactory {

  val esEvents: Events = stub[Events]
  val ingestionServices: IngestionServices = stub[IngestionServices]

  lazy val manifest = {
    Neo4jManifest.setupManifest(neo4jDriver, global, neo4jQueryLoggingConfig).toOption.get
  }

  def insertIngestion(collection: Uri, maybeIngestion: Option[Uri] = None, maybePath: Option[Path] = None, fixed: Boolean = true) = {
    val ingestion = maybeIngestion.getOrElse(collection.chain("test-ingestion"))
    val path = maybePath.getOrElse(Paths.get(ingestion.value))

    manifest.insertIngestion(collection, ingestion, "My test ingestion!", Some(path), List(English), fixed, default = false)
  }

  "Neo4JManifest" - {
    "Can get the mimetypes" in {
      manifest.getAllMimeTypes.successValue shouldBe List.empty[MimeType]
    }

    "Can create a collection" in {
      val result = manifest.insertCollection("test-collection", "Test Collection", "test")
      result.eitherValue.isRight shouldBe true
      manifest.getCollections.successValue.length shouldBe 1
      manifest.getCollection(Uri("test-collection")).successValue.display shouldBe "Test Collection"
    }

    "Fails to create an ingestion in a non-existent collection" in {
      val result = insertIngestion(Uri("non-existent-collection"))
      result.failureValue shouldBe NotFoundFailure("Collection 'non-existent-collection' does not exist.")
    }

    "Can create an ingestion in a collection that exists" in {
      val result = insertIngestion(Uri("test-collection"), maybePath = Some(Paths.get("/test/path")))
      result.successValue shouldBe Uri("test-collection/test-ingestion")
      manifest.getIngestionCount(Uri("test-collection")).successValue shouldBe 1
      val ingestion = manifest.getIngestions(Uri("test-collection")).successValue.head
      ingestion.display shouldBe "My test ingestion!"
      ingestion.path should contain("/test/path")
      ingestion.uri shouldBe "test-collection/test-ingestion"
    }

    "Emails" - {
      val person1 = model.Recipient(Some("Bob"), "bob@example.com")
      val person2 = model.Recipient(Some("Alice"), "alice@example.com")
      val person3 = model.Recipient(Some("Charlie"), "charlie@example.org")

      def sentAt(hour: Int, minute: Int): OffsetDateTime = OffsetDateTime.of(2018, 2, 26, hour, minute, 0, 0, ZoneOffset.UTC)
      def email(uri: String, sentAt: OffsetDateTime, from: Recipient, to: List[Recipient], subject: String,
                replies: List[String] = Nil, refs: List[String] = Nil) =
        Email(
          Uri(uri), Some(person1), List(person2), Some(DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(sentAt)),
          None, None, subject,
          s"Hi ${to.flatMap(_.displayName).mkString(", ")}! Love from ${from.displayName.getOrElse("?")}",
          replies, refs, None, 0, Map.empty, None
        )

      val emails: Seq[Manifest.InsertEmail] = Seq(
        Manifest.InsertEmail(email("a", sentAt(10, 40), person1, List(person2, person3), "Hey! Friend!"), Uri("test-collection/test-ingestion")),
        Manifest.InsertEmail(email("b", sentAt(10, 50), person2, List(person1, person3), "Hey! Friend!", List("a")), Uri("test-collection/test-ingestion")),
        Manifest.InsertEmail(email("c", sentAt(11, 40), person3, List(person1), "Hey! Friend!", List("b"), List("a")), Uri("test-collection/test-ingestion")),
        Manifest.InsertEmail(email("d", sentAt(15, 40), person3, List(person2), "Hey! Friend!"), Uri("test-collection/test-ingestion"))
      )

      "Can insert emails" in {
        val result = manifest.insert(emails, Uri("test-collection/test-ingestion"))
        if (result.isLeft) {
          val value = result.left.get
          logger.warn(value.toString, value.cause.get)
        }
        result.isRight shouldBe true
        manifest.getResource(Uri("a")).toOption.get.`type` shouldBe "email"
        manifest.getResource(Uri("b")).toOption.get.`type` shouldBe "email"
        manifest.getResource(Uri("c")).toOption.get.`type` shouldBe "email"
      }

      "Can retrieve a thread" in {
        val expected = Set(
          EmailNeighbours(FrontendEmail("a", true, Some("Hey! Friend!"), None), Set.empty),
          EmailNeighbours(FrontendEmail("b", true, Some("Hey! Friend!"), None), Set(Neighbour("IN_REPLY_TO", "a"))),
          EmailNeighbours(FrontendEmail("c", true, Some("Hey! Friend!"), None), Set(Neighbour("IN_REPLY_TO", "b"), Neighbour("REFERENCED", "a")))
        )

        val resultsA = manifest.getEmailThread("a").successValue
        resultsA.length shouldBe 3

        val resultsB = manifest.getEmailThread("b").successValue
        resultsB.length shouldBe 3

        val resultsC = manifest.getEmailThread("c").successValue
        resultsC.length shouldBe 3

        resultsA.toSet shouldBe expected
        resultsB.toSet shouldBe expected
        resultsC.toSet shouldBe expected

        val resultsD = manifest.getEmailThread("d").successValue
        resultsD.length shouldBe 1
      }
    }

    "Extractors" - {
      def extractor(_name: String, _priority: Int, costFn: Long => Long = identity): Extractor = new Extractor {
        override def name: String = _name
        override def canProcessMimeType: String => Boolean = (_: String) => true
        override def indexing: Boolean = false
        override def priority: Int = _priority
        override def cost(mimeType: MimeType, size: Long): Long = costFn(size)
        override def extract(blob: Blob, inputStream: InputStream, params: ExtractionParams): Either[Failure, Unit] = ???
      }

      val extractors: Map[String, Extractor] = Map(
        "ArchiveExtractor" -> 5,
        "RarExtractor" -> 5,
        "DocumentBodyExtractor" -> 4,
        "PdfOcrExtractor" -> 1
      ).map { case(name, priority) => name -> extractor(name, priority) }

      def blob(uri: Uri, extractors: List[Extractor], ingestion: String, size: Long = 1024L, workspace: Option[String] = None) = {
        Manifest.InsertBlob(
          IngestionFile(
            uri, Uri(uri.value.split("/").dropRight(1).mkString("/")), size,
            None, None, None, true
          ),
          Uri(Hashing.goodFastHash(32).hashString(uri.value, StandardCharsets.UTF_8).toString),
          parentBlobs = List.empty,
          MimeType("application/test"),
          ingestion,
          List(English.key),
          extractors,
          workspace = workspace.map { id =>
            WorkspaceItemContext(id, id, uri.value)
          }
        )
      }

      def fetchWork(worker: String, maxBatchSize: Int, maxCost: Int = 10000): List[(Uri, String)] = {
        val result = manifest.fetchWork(worker, maxBatchSize, maxCost)
        result.toOption.get.map { case WorkItem(blob, _, extractor, _, List(English), _) => blob.uri -> extractor }
      }

      def buildBlobs(collection: String, ingestion: String) = List(
        blob(Uri(s"$collection/zip"), List(extractors("ArchiveExtractor")), ingestion),
        blob(Uri(s"$collection/rar"), List(extractors("RarExtractor")), ingestion),
        blob(Uri(s"$collection/pdf1"), List(extractors("DocumentBodyExtractor"), extractors("PdfOcrExtractor")), ingestion),
        blob(Uri(s"$collection/pdf2"), List(extractors("DocumentBodyExtractor"), extractors("PdfOcrExtractor")), ingestion)
      )

      def markAsComplete(blob: Manifest.InsertBlob, ingestion: String, extractor: Extractor) = {
        manifest.markAsComplete(ExtractionParams(ingestion, List(English), List.empty, None), Blob(blob.blobUri, 0, Set.empty), extractor)
      }

      "Can retrieve work by extractor priority" in {
        val blobs = buildBlobs("priority_test", "priority_test/test")

        manifest.insertCollection("priority_test", "priority_test", "test").eitherValue.isRight should be(true)
        manifest.insertIngestion(Uri("priority_test"), Uri("priority_test/test"), "test", None, List(English), fixed = false, default = false).eitherValue.isRight should be(true)
        manifest.insert(blobs, Uri("priority_test/test")).isRight should be(true)

        fetchWork("test", maxBatchSize = 2) should contain allOf(
          blobs(0).blobUri -> "ArchiveExtractor",
          blobs(1).blobUri -> "RarExtractor"
        )

        markAsComplete(blobs(0), "priority_test/test", extractors("ArchiveExtractor")).isRight should be(true)
        markAsComplete(blobs(1), "priority_test/test", extractors("RarExtractor")).isRight should be(true)
        manifest.releaseLocks("test").isRight should be(true)

        fetchWork("test", maxBatchSize = 2) should contain allOf(
          blobs(2).blobUri -> "DocumentBodyExtractor",
          blobs(3).blobUri -> "DocumentBodyExtractor"
        )

        markAsComplete(blobs(2), "priority_test/test", extractors("DocumentBodyExtractor")).isRight should be(true)
        markAsComplete(blobs(3), "priority_test/test", extractors("DocumentBodyExtractor")).isRight should be(true)
        manifest.releaseLocks("test").isRight should be(true)

        fetchWork("test", maxBatchSize = 2) should contain allOf(
          blobs(2).blobUri -> "PdfOcrExtractor",
          blobs(3).blobUri -> "PdfOcrExtractor"
        )

        markAsComplete(blobs(2), "priority_test/test", extractors("PdfOcrExtractor")).isRight should be(true)
        markAsComplete(blobs(3), "priority_test/test", extractors("PdfOcrExtractor")).isRight should be(true)
        manifest.releaseLocks("test").isRight should be(true)

        fetchWork("test", maxBatchSize = 2) shouldBe empty
      }

      "Can batch work by todo cost" in {
        val documentBodyExtractor = extractor("DocumentBodyExtractor", 4)
        val pdfOcrExtractor = extractor("PdfOcrExtractor", 1, _ * 100)

        val blobs = List(
          blob(Uri(s"cost_test/test1.txt"), List(documentBodyExtractor), ingestion = "cost_test/test", size = 10),
          blob(Uri(s"cost_test/test2.txt"), List(documentBodyExtractor), ingestion = "cost_test/test", size = 10),
          blob(Uri(s"cost_test/test3.txt"), List(documentBodyExtractor), ingestion = "cost_test/test", size = 5),
          blob(Uri(s"cost_test/test4.pdf"), List(pdfOcrExtractor), ingestion = "cost_test/test", size = 10)
        )

        manifest.insertCollection("cost_test", "cost_test", "test").eitherValue.isRight should be(true)
        manifest.insertIngestion(Uri("cost_test"), Uri("cost_test/test"), "test", None, List(English), fixed = false, default = false).eitherValue.isRight should be(true)
        manifest.insert(blobs, Uri("cost_test/test")).isRight should be(true)

        fetchWork("test", maxBatchSize = 10, maxCost = 30) should contain only(
          blobs(0).blobUri -> "DocumentBodyExtractor",
          blobs(1).blobUri -> "DocumentBodyExtractor",
          blobs(2).blobUri -> "DocumentBodyExtractor"
        )

        markAsComplete(blobs(0), "cost_test/test", extractors("DocumentBodyExtractor")).isRight should be(true)
        markAsComplete(blobs(1), "cost_test/test", extractors("DocumentBodyExtractor")).isRight should be(true)
        markAsComplete(blobs(2), "cost_test/test", extractors("DocumentBodyExtractor")).isRight should be(true)
        manifest.releaseLocks("test").isRight should be(true)

        fetchWork("test", maxBatchSize = 10, maxCost = 30) should contain only(
          blobs(3).blobUri -> "PdfOcrExtractor"
        )

        markAsComplete(blobs(3), "cost_test/test", extractors("PdfOcrExtractor")).isRight should be(true)
        manifest.releaseLocks("test").isRight should be(true)

        fetchWork("test", maxBatchSize = 10, maxCost = 20) shouldBe empty
      }

      "Can get single batch of heavy work" in {
        val pdfOcrExtractor = extractor("PdfOcrExtractor", 1, _ * 100)

        val blobs = List(
          blob(Uri(s"single_heavy/bigboi.pdf"), List(pdfOcrExtractor), ingestion = "single_heavy/test", size = 10)
        )

        manifest.insertCollection("single_heavy", "single_heavy", "test").eitherValue.isRight should be(true)
        manifest.insertIngestion(Uri("single_heavy"), Uri("single_heavy/test"), "test", None, List(English), fixed = false, default = false).eitherValue.isRight should be(true)
        manifest.insert(blobs, Uri("single_heavy/test")).isRight should be(true)

        fetchWork("test", maxBatchSize = 10, maxCost = 5) should contain only(
          blobs(0).blobUri -> "PdfOcrExtractor"
        )

        markAsComplete(blobs(0), "single_heavy/test", extractors("PdfOcrExtractor")).isRight should be(true)
        manifest.releaseLocks("test").isRight should be(true)
        fetchWork("test", maxBatchSize = 10, maxCost = 5) shouldBe empty
      }

      "Another worker can pick up work from a worker that was terminated midway through a task" in {
        val pdfOcrExtractor = extractor("PdfOcrExtractor", 1, _ * 100)

        val blobs = List(
          blob(Uri(s"lock_breaking/bigboi.pdf"), List(pdfOcrExtractor), ingestion = "lock_breaking/test", size = 10)
        )

        manifest.insertCollection("lock_breaking", "lock_breaking", "test").eitherValue.isRight should be(true)
        manifest.insertIngestion(Uri("lock_breaking"), Uri("lock_breaking/test"), "test", None, List(English), fixed = false, default = false).eitherValue.isRight should be(true)
        manifest.insert(blobs, Uri("lock_breaking/test")).isRight should be(true)

        fetchWork("workerOne", maxBatchSize = 10, maxCost = 5) should contain only(
          blobs(0).blobUri -> "PdfOcrExtractor"
          )

        // The worker does not release the locks, they are released by another worker as this one is now terminated
        manifest.releaseLocksForTerminatedWorkers(List("workerTwo")).isRight should be(true)

        // The new worker picks up the work
        fetchWork("workerTwo", maxBatchSize = 10, maxCost = 5) should contain only(
          blobs(0).blobUri -> "PdfOcrExtractor"
          )
      }

      "Can distribute work" in {
        val blobs = buildBlobs("distribution_test", "distribution_test/test")

        manifest.insertCollection("distribution_test", "distribution_test", "test").eitherValue.isRight should be(true)
        manifest.insertIngestion(Uri("distribution_test"), Uri("distribution_test/test"), "test", None, List(English), fixed = false, default = false).eitherValue.isRight should be(true)
        manifest.insert(blobs, Uri("distribution_test/test")).isRight should be(true)

        fetchWork("worker_one", maxBatchSize = 2) should contain allOf(
          blobs(0).blobUri -> "ArchiveExtractor",
          blobs(1).blobUri -> "RarExtractor"
        )

        fetchWork("worker_two", maxBatchSize = 2) should contain allOf(
          blobs(2).blobUri -> "DocumentBodyExtractor",
          blobs(3).blobUri -> "DocumentBodyExtractor"
        )
      }

      "Can skip work that has already been attempted" in {
        val blobs = buildBlobs("skip_attempted_test", "skip_attempted_test/test")

        manifest.insertCollection("skip_attempted_test", "skip_attempted_test","test").eitherValue.isRight should be(true)
        manifest.insertIngestion(Uri("skip_attempted_test"), Uri("skip_attempted_test/test"), "test", None, List(English), fixed = false, default = false).eitherValue.isRight should be(true)
        manifest.insert(blobs, Uri("skip_attempted_test/test")).isRight should be(true)

        for(_ <- 0 until manifest.maxExtractionAttempts) {
          val (uri, _) = fetchWork("worker_one", maxBatchSize = 1).head
          uri should be(blobs(0).blobUri)
        }

        val (uri, _) = fetchWork("worker_one", maxBatchSize = 1).head
        uri should be(blobs(1).blobUri)
      }

      "Can run the same extractor for multiple ingestions" in {
        val collection = Uri("multiple_ingestions")
        val ingestions = (0 until 2).map { n => collection.chain(s"ingestion$n") }

        manifest.insertCollection(collection.value, collection.value, "test").eitherValue.isRight should be(true)
        ingestions.foreach { ingestion =>
          insertIngestion(collection, Some(ingestion)).eitherValue.isRight should be(true)
        }

        val blobs = List(
          blob(ingestions(0).chain("zip1"), List(extractors("ArchiveExtractor")), ingestions(0).value),
          blob(ingestions(1).chain("zip1"), List(extractors("ArchiveExtractor")), ingestions(1).value),
          blob(ingestions(0).chain("zip2"), List(extractors("ArchiveExtractor")), ingestions(0).value)
        )

        manifest.insert(blobs, collection).isRight should be(true)

        val rawResults = manifest.fetchWork("test", maxBatchSize = 3, maxCost = 10000).toOption.get
        val results = rawResults.map { case WorkItem(blob, _, _,  ingestion, List(English), _) => blob.uri -> ingestion }

        results should contain allOf(
          blobs(0).blobUri -> ingestions(0).value,
          blobs(1).blobUri -> ingestions(1).value,
          blobs(2).blobUri -> ingestions(0).value
        )
      }

      "Can prioritise processing user uploaded content" in {
        val collection = Uri("mixed_user_uploaded_and_cli_uploaded")
        val ingestions = (0 until 2).map { n => collection.chain(s"ingestion$n") }

        manifest.insertCollection(collection.value, collection.value, "test").eitherValue.isRight should be(true)
        ingestions.foreach { ingestion =>
          insertIngestion(collection, Some(ingestion)).eitherValue.isRight should be(true)
        }

        val blobs = List(
          blob(ingestions(0).chain("cli_uploaded.zip"), List(extractors("ArchiveExtractor")), ingestions(0).value),
          blob(ingestions(0).chain("also_cli_uploaded.zip"), List(extractors("ArchiveExtractor")), ingestions(0).value),
          blob(ingestions(1).chain("user_uploaded.zip"), List(extractors("ArchiveExtractor")), ingestions(1).value,
            workspace = Some("test-workspace"))
        )

        manifest.insert(List(blobs(0)), collection).isRight should be(true)

        val firstItem = manifest.fetchWork("test", maxBatchSize = 1, maxCost = 10000).toOption.get.head
        firstItem.blob.uri should be(blobs(0).blobUri)

        val wut = manifest.insert(List(blobs(1), blobs(2)), collection)
        wut.isRight should be(true)

        val secondItem = manifest.fetchWork("test", maxBatchSize = 1, maxCost = 10000).toOption.get.head
        secondItem.blob.uri should be(blobs(2).blobUri)
      }
    }

    "Upload" - {
      "Cannot upload to a collection the user did not create" in {
        val collectionUri = Uri("not_mine")
        val ingestionUri = collectionUri.chain("test")

        manifest.insertCollection(collectionUri.value, collectionUri.value, createdBy = "me").eitherValue.isRight should be(true)
        insertIngestion(collectionUri, Some(ingestionUri)).eitherValue.isRight should be(true)

        val fileToUpload = Files.createTempFile("pfi-upload-test", ".txt")
        val originalFilePath = Paths.get("/wut/up")

        Files.write(fileToUpload, "This is a test".getBytes(StandardCharsets.UTF_8))

        val command = new IngestFile(collectionUri, ingestionUri, "test", None, "someoneElse", fileToUpload, originalFilePath, None, manifest, esEvents, ingestionServices, null)(global)
        command.process().eitherValue.left.get shouldBe a [MissingPermissionFailure]
      }

      "Cannot upload to a fixed ingestion" in {
        val collectionUri = Uri("fixed")
        val ingestionUri = collectionUri.chain("test")

        manifest.insertCollection(collectionUri.value, collectionUri.value, createdBy = "me").eitherValue.isRight should be(true)
        insertIngestion(collectionUri, Some(ingestionUri)).eitherValue.isRight should be(true)

        val fileToUpload = Files.createTempFile("pfi-upload-test", ".txt")
        val originalFilePath = Paths.get("/wut/up")

        Files.write(fileToUpload, "This is a test".getBytes(StandardCharsets.UTF_8))

        val command = new IngestFile(collectionUri, ingestionUri, "test", None, "someoneElse", fileToUpload, originalFilePath, None, manifest, esEvents, ingestionServices, null)(global)
        command.process().eitherValue.left.get shouldBe a [MissingPermissionFailure]
      }

      "Upload" in {
        val collectionUri = Uri("upload")
        val ingestionUri = collectionUri.chain("test")
        val objectStorage: ObjectStorage = mock[ObjectStorage]
        (objectStorage.create _).expects(*, *, *).returning(Right(()))
        val mimeTypeMapper: MimeTypeMapper = new MimeTypeMapper
        val index = mock[Index]
        (index.ingestDocument _).expects(*, *, *, *).returning(Attempt.Right(()))
        val tika: Tika = Tika.createInstance
        val ingestionServices: IngestionServices = IngestionServices(manifest, index, objectStorage, tika, mimeTypeMapper)(scala.concurrent.ExecutionContext.global)

        manifest.insertCollection(collectionUri.value, collectionUri.value, createdBy = "me").eitherValue.isRight should be(true)
        insertIngestion(collectionUri, Some(ingestionUri), fixed = false).eitherValue.isRight should be(true)

        val fileToUpload = Files.createTempFile("pfi-upload-test", ".txt")
        val originalFilePath = Paths.get("/wut/up")

        Files.write(fileToUpload, "This is a test".getBytes(StandardCharsets.UTF_8))

        val command = new IngestFile(collectionUri, ingestionUri, "test", None, "me", fileToUpload, originalFilePath, None, manifest, esEvents, ingestionServices, null)(global)
        val result = command.process().eitherValue
        result.isRight should be(true)

        manifest.getResource(Uri("upload/test/wut/up")).toOption.get.children(0).`type` shouldBe "blob"
      }
    }
  }
}
