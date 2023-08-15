package extraction

import java.io.InputStream
import java.util.concurrent.atomic.AtomicInteger
import cats.syntax.either._
import extraction.Worker.Batch
import model.manifest.{Blob, WorkItem}
import services.{Metrics, MetricsService, ObjectStorage}
import services.manifest.WorkerManifest
import services.observability.{Details, IngestionEvent, IngestionEventType, MetaData, PostgresClient}
import utils.Logging
import utils.attempt._

import scala.concurrent.ExecutionContext
import scala.language.postfixOps
import scala.util.control.NonFatal

object Worker extends Logging {
  type Batch = List[(Extractor, Blob, ExtractionParams)]
}

class Worker(
  val name: String,
  manifest: WorkerManifest,
  blobStorage: ObjectStorage,
  extractors: List[Extractor],
  metricsService: MetricsService,
  postgresClient: PostgresClient)(implicit executionContext: ExecutionContext) extends Logging {

  private val maxBatchSize = 1000 // tasks
  private val maxCost = 100 * 1024 * 1024 // 100MB

  def pollAndExecute(): Attempt[Int] = {
    fetchBatch().map { work =>
      val completed = executeBatch(work)
      manifest.releaseLocks(name)
      completed
    }.recoverWith {
      case err =>
        metricsService.updateMetric(Metrics.batchesFailed)
        // on failure, fetchBatch just returns the first failure
        logger.error("Error executing batch", err)
        manifest.releaseLocks(name)
        Attempt.Left(err)
    }
  }

  def fetchBatch(): Attempt[Batch] = {
    logger.info("Fetching work")

    manifest.fetchWork(name, maxBatchSize, maxCost).toAttempt.flatMap { work =>
      Attempt.traverse(work) {
        case WorkItem(blob, parentBlobs, extractorName, ingestion, languages, workspace) =>
          extractors.find(_.name == extractorName) match {
            case Some(extractor) =>
              Attempt.Right((extractor, blob, ExtractionParams(ingestion, languages, parentBlobs, workspace)))

            case _ =>
              logger.error(s"Unknown extractor $extractorName")
              Attempt.Left(UnsupportedOperationFailure(s"Unknown extractor $extractorName"))
          }
      }
    }
  }

  def executeBatch(work: Batch): Int = {
    if(work.nonEmpty) {
      logger.info(s"Found work: ${work.size} assignments")
    } else {
      logger.info("No work found")
    }

    work.foldLeft(0) { case(completed, (extractor, blob, params)) =>
      logger.info(s"Working on ${blob.uri.value} with ${extractor.name}")

      val result = blobStorage.get(blob.uri.toStoragePath)
        .flatMap(safeInvokeExtractor(params, extractor, blob, _))


      result match {
        case Right(_) =>
          markAsComplete(params, blob, extractor)
          postgresClient.insertEvent(
            IngestionEvent(
              MetaData(blob.uri.value, params.ingestion),
              IngestionEventType.RunExtractor,
              details = Details.extractorDetails(extractor.name))
          )
          completed + 1

        case Left(SubprocessInterruptedFailure) =>
          logger.info(s"Subprocess terminated while processing ${blob.uri.value}")
          logger.info("We expect this to happen when a worker instance is terminated midway through a job")
          logger.info("I am not marking it in an extraction failure to allow a new worker to pick up the work")

          completed

        case Left(failure) =>
          markAsFailure(blob, extractor, failure)
          metricsService.updateMetric(Metrics.itemsFailed)
          logger.error(s"Ingest batch execution failure, ${failure.msg}", failure.toThrowable)

          postgresClient.insertEvent(
            IngestionEvent(
              MetaData(blob.uri.value, params.ingestion),
              IngestionEventType.RunExtractor,
              details = Details.extractorErrorDetails(
                extractor.name, failure.msg, failure.cause.map(throwable => throwable.getStackTrace.toString)
              )
            )
          )
          completed
      }
    }
  }

  // Ideally the extractor is very well behaved, catches any exceptions and wraps them in an Either...
  // but that's not always going to be true (especially if we had true pluggable extractors).
  // This code is a safety catch-all so that we don't throw away the rest of the batch.
  private def safeInvokeExtractor(params: ExtractionParams, extractor: Extractor, blob: Blob, data: InputStream): Either[Failure, Unit] = try {
    extractor.extract(blob, data, params)
  } catch {
    case NonFatal(e) =>
      Left(UnknownFailure(e))
  }

  private def markAsComplete(params: ExtractionParams, blob: Blob, extractor: Extractor): Unit = {
    manifest.markAsComplete(params, blob, extractor).leftMap { failure =>
      logger.error(s"Failed to mark '${blob.uri.value}' processed by '${extractor.name}' as complete: ${failure.msg}")
    }
  }

  private def markAsFailure(blob: Blob, extractor: Extractor, failure: Failure): Unit = {
    logger.error(s"Error in '${extractor.name} processing ${blob.uri.value}': ${failure.msg}")

    manifest.logExtractionFailure(blob.uri, extractor.name, failure.msg).left.foreach { f =>
      logger.error(s"Failed to log extractor in manifest: ${f.msg}")
    }
  }
}
