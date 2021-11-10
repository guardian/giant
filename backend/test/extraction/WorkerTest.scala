package extraction

import java.io.InputStream
import java.nio.file.Path
import model.manifest.{Blob, WorkItem}
import model.{English, ObjectMetadata, Uri}
import org.scalatest.EitherValues
import services.{DefaultMetricsService, ObjectStorage}
import services.manifest.Manifest.WorkCounts
import services.manifest.WorkerManifest
import utils.attempt.AttemptAwait._
import utils.attempt.{Failure, IllegalStateFailure}

import scala.concurrent.ExecutionContext.Implicits.global
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import play.api.mvc.Result
import utils.auth.User
import utils.controller.DefaultFailureToResultMapper

//noinspection NotImplementedCode
class WorkerTest extends AnyFlatSpec with Matchers with EitherValues {
  private val blob = Blob(Uri("test"), 0, Set.empty)

  private val happy = extractor("happy")
  private val sad = extractor("sad", Left(IllegalStateFailure("I am a sad extractor")))
  private val extractors = List(happy, sad)

  it should "execute batch" in {
    val work = List(
      WorkItem(blob, List.empty, happy.name, "test", List(English), None),
      WorkItem(blob, List.empty, sad.name, "test", List(English), None)
    )
    
    val manifest = new TestWorkerManifest(work)

    val completed = worker(extractors, manifest).pollAndExecute().await()
    completed should be(1)

    manifest.completed should have size 1
    manifest.completed.headOption.map(_._2.name) should contain(happy.name)

    manifest.failures should have size 1
    manifest.failures.headOption.map(_._2) should contain(sad.name)
  }

  it should "return the number of completed tasks" in {
    val work = List.tabulate(10) { n => WorkItem(blob.copy(uri = Uri(s"test$n")), List.empty, extractors(n % extractors.length).name, "test", List(English), None) }

    val manifest = new TestWorkerManifest(work)
    val theWorker = worker(extractors, manifest)

    val completed = theWorker.pollAndExecute().await()
    completed should be(5)
  }

  it should "always lock break even on failure" in {
    val manifest = new TestWorkerManifest(List(WorkItem(blob, List.empty, sad.name, "test", List(English), None)))

    worker(List(sad), manifest).pollAndExecute().await()
    manifest.locksBroken should be(true)
  }

  it should "catch exceptions thrown from extractor" in {
    val verySad = extractor("verySad", exception = Some(new IllegalStateException("I am a very sad extractor")))
    val manifest = new TestWorkerManifest(List(WorkItem(blob, List.empty, verySad.name, "test", List(English), None)))

    worker(List(verySad), manifest).pollAndExecute().await()
    manifest.failures should have size 1
    manifest.failures.headOption.map(_._2) should contain(verySad.name)
  }

  private def extractor(_name: String, result: Either[Failure, Unit] = Right(()), exception: Option[Throwable] = None): Extractor = new Extractor {
    override def name = _name
    override def canProcessMimeType = ???
    override def extract(blob: Blob, inputStream: InputStream, params: ExtractionParams) = exception match {
      case Some(err) => throw err
      case _ => result
    }
    override def indexing = ???
    override def priority = ???
  }

  private def worker(extractors: List[Extractor], manifest: WorkerManifest): Worker = {
    val blobStorage = new ObjectStorage {
      override def get(key: String): Either[Failure, InputStream] = Right(null)
      override def getMetadata(key: String): Either[Failure, ObjectMetadata] = ???
      override def create(key: String, path: Path, mimeType: Option[String]): Either[Failure, Unit] = ???
      override def delete(key: String): Either[Failure, Unit] = ???
    }

    new Worker("test", manifest, blobStorage, extractors, new DefaultMetricsService)(scala.concurrent.ExecutionContext.global)
  }
}

class TestWorkerManifest(work: List[WorkItem]) extends WorkerManifest {
  var completed: List[(Blob, Extractor)] = List.empty
  var failures: List[(Uri, String, String)] = List.empty

  var locksBroken: Boolean = false

  override def fetchWork(workerName: String, maxBatchSize: Int, maxCost: Int): Either[Failure, List[WorkItem]] = {
    Right(work)
  }

  override def markAsComplete(params: ExtractionParams, blob: Blob, extractor: Extractor): Either[Failure, Unit] = {
    completed :+= blob -> extractor
    Right(())
  }

  override def logExtractionFailure(blobUri: Uri, extractorName: String, stackTrace: String): Either[Failure, Unit] = {
    failures :+= (blobUri, extractorName, stackTrace)
    Right(())
  }

  override def releaseLocks(workerName: String): Either[Failure, Unit] = {
    locksBroken = true
    Right(())
  }
  
  override def releaseLocksForTerminatedWorkers(runningWorkerNames: List[String]): Either[Failure, Unit] = {
    Right(())
  }

  override def getWorkCounts(): Either[Failure, WorkCounts] = {
    Right(WorkCounts(inProgress = 0, outstanding = work.size))
  }

  override def setProgressNote(blobUri: Uri, extractor: Extractor, note: String): Either[Failure, Unit] = {
    Right(())
  }
}
