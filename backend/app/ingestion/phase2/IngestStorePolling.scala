package ingestion.phase2

import java.nio.file.{Files, Path}
import java.util.UUID
import org.apache.pekko.actor.{ActorSystem, Cancellable}
import cats.syntax.either._
import model.Uri
import model.ingestion.Key
import services.ingestion.IngestionServices
import services.{FingerprintServices, IngestStorage, MetricUpdate, Metrics, MetricsService, ScratchSpace}
import utils.attempt.{Attempt, ElasticSearchQueryFailure, Failure, UnknownFailure}
import utils.{Logging, WorkerControl}

import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal
import scala.util.{Success, Failure => SFailure}
import services.observability.{EventDetails, IngestionEvent, IngestionEventType, EventMetadata, PostgresClient, EventStatus}


case class WorkSelector(numberOfNodes: Int, thisNode: Int) extends Logging {
  def isSelected(long: Long): Boolean = {
    val workNode = math.abs(long % numberOfNodes)
    workNode == thisNode
  }
}

class IngestStorePolling(
  actorSystem: ActorSystem,
  executionContext: ExecutionContext,
  workerControl: WorkerControl,
  ingestStorage: IngestStorage,
  scratchSpace: ScratchSpace,
  ingestionServices: IngestionServices,
  batchSize: Int,
  metricsService: MetricsService,
  postgresClient: PostgresClient) extends Logging {
  implicit val workerContext: ExecutionContext = executionContext

  private val minimumWait = 10.second
  private val maximumWait = 1.minute

  var cancellable: Option[Cancellable] = None

  def start() = {
    // wait a minute before we start anything so the cluster config settles
    schedulePoll(maximumWait)
  }

  def stop(): Future[Unit] = {
    Future.successful(cancellable.foreach(_.cancel()))
  }

  def schedulePoll(duration: FiniteDuration): Unit = {
    cancellable = Some(actorSystem.scheduler.scheduleOnce(duration) { pollIngestStore() })
  }

  def pollIngestStore(): Unit = {
    try {
      val pollCompleteFuture: Future[FiniteDuration] = getNextBatch.fold(
        failure => {
          logger.warn(s"Failed to poll ingestion store $failure")
          metricsService.updateMetric(Metrics.batchesFailed)
          maximumWait
        },
        batch => {
          if(batch.isEmpty) {
            maximumWait
          } else {
            val results = batch.map { key =>
              logger.info(s"Processing $key")

              val result = processKey(key)
              result match {
                case Left(failure) =>
                  metricsService.updateMetric(Metrics.itemsFailed)
                  logger.warn(s"Failed to process $key: $failure. File will be moved to dead letter bucket. To re-ingest the file, " +
                    s"either re-upload it or use the /api/ingestion/retry-dead-letter-files endpoint to re-ingest all dead letter files.")
                  ingestStorage.sendToDeadLetterBucket(key)
                case _ => ingestStorage.delete(key)
              }
              result
            }.collect { case Right(success) => success }
            metricsService.updateMetrics(List(
              MetricUpdate(Metrics.itemsIngested, results.size),
              MetricUpdate(Metrics.batchesIngested, 1)))
            logger.info(s"Processed ${results.size}. Checking for work again in $minimumWait")
            minimumWait
          }
        }
      )
      pollCompleteFuture.onComplete {
        case Success(pollDuration) => schedulePoll(pollDuration)
        case SFailure(t) =>
          logger.error("Exception whilst processing ingestion batch", t)
          metricsService.updateMetric(Metrics.batchesFailed)
          schedulePoll(maximumWait)
      }
    } catch {
      case NonFatal(t) =>
        logger.error("Exception whilst getting next batch from ingestion store", t)
        metricsService.updateMetric(Metrics.batchesFailed)
        schedulePoll(maximumWait)
    }
  }

  def processKey(key: Key): Either[Failure, Unit] = {
    for {
      context <- ingestStorage.getMetadata(key)
      _ <- IngestStorePolling.fetchData(key, ingestStorage, scratchSpace) { case (path, fingerprint) =>
        val ingestionMetaData = EventMetadata(fingerprint.value, context.ingestion)

        try {
          val ingestResult = ingestionServices.ingestFile(context, fingerprint, path)
          ingestResult match {
            case Left(failure) =>
              val details = EventDetails.errorDetails(failure.msg, failure.cause.map(throwable => throwable.getStackTrace.toString) )
              postgresClient.insertEvent { failure match {
                case _: ElasticSearchQueryFailure =>
                  IngestionEvent(ingestionMetaData, eventType = IngestionEventType.InitialElasticIngest, status = EventStatus.Failure, details = details)
                case _ =>
                  IngestionEvent(ingestionMetaData, eventType = IngestionEventType.IngestFile, status = EventStatus.Failure, details = details)
              }}

            case Right(_) => postgresClient.insertEvent(IngestionEvent(ingestionMetaData, eventType = IngestionEventType.IngestFile))
          }
          ingestResult
        } catch {
          case NonFatal(t) =>
            logger.error(s"Unexpected exception", t)
            throw t
        }
      }
    } yield {
      ()
    }
  }

  def getNextBatch: Attempt[Iterable[(Long, UUID)]] = {
    for {
      selector <- workSelector
      keys <- ingestStorage.list.toAttempt
    } yield {
      logger.info(s"Getting batch for node ${selector.thisNode} (of ${selector.numberOfNodes})")
      val batch = keys
        .filter { case (_, uuid) =>
          selector.isSelected(uuid.getLeastSignificantBits)
        }
        .take(batchSize)
      logger.info(s"Got a batch of size ${batch.size} for node ${selector.thisNode}")
      batch
    }
  }

  def workSelector: Attempt[WorkSelector] = {
    workerControl.getWorkerDetails.map { details =>
      logger.info(s"Cluster state ${details}")
      WorkSelector(details.nodes.size, details.nodes.toSeq.indexOf(details.thisNode))
    }
  }
}

object IngestStorePolling extends Logging {
  /* Fetches the data from the object store, computing the fingerprint in flight */
  def fetchData[T](key: Key, ingestStorage: IngestStorage, scratchSpace: ScratchSpace)(f: (Path, Uri) => Either[Failure, T]): Either[Failure, T] = {
    ingestStorage.getData(key).flatMap { sourceInputStream =>
      try {
        Either.catchNonFatal {
          val path = scratchSpace.pathFor(key)
          logger.info(s"Fetching data for $key to $path")

          Files.copy(sourceInputStream, path)
          path -> Uri(FingerprintServices.createFingerprintFromFile(path.toFile))
        }.leftMap(UnknownFailure.apply)
      } finally {
        sourceInputStream.close()
      }
    }.flatMap{ case (path, uri) =>
      try {
        f(path, uri)
      } finally {
        Files.delete(path)
      }
    }
  }
}
