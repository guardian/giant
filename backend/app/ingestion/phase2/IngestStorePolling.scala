package ingestion.phase2

import java.nio.file.{Files, Path}
import java.util.UUID
import akka.actor.{ActorSystem, Cancellable}
import cats.syntax.either._
import model.Uri
import model.ingestion.Key
import services.ingestion.IngestionServices
import services.{FingerprintServices, IngestStorage, ScratchSpace}
import utils.attempt.{Attempt, Failure, UnknownFailure}
import utils.controller.FailureToResultMapper
import utils.{Logging, WorkerControl}

import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal
import scala.util.{Success, Failure => SFailure}

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
  failureToResultMapper: FailureToResultMapper) extends Logging {
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
          failureToResultMapper.failureToResult(failure)
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
                  failureToResultMapper.failureToResult(failure)
                  logger.warn(s"Failed to process $key: $failure")
                case _ => ingestStorage.delete(key)
              }
              result
            }.collect { case Right(success) => success }
            logger.info(s"Processed ${results.size}. Checking for work again in $minimumWait")
            minimumWait
          }
        }
      )
      pollCompleteFuture.onComplete {
        case Success(pollDuration) => schedulePoll(pollDuration)
        case SFailure(NonFatal(t)) =>
          logger.error("Exception whilst processing ingestion batch", t)
          failureToResultMapper.failureToResult(UnknownFailure(t))
          schedulePoll(maximumWait)
      }
    } catch {
      case NonFatal(t) =>
        logger.error("Exception whilst getting next batch from ingestion store", t)
        failureToResultMapper.failureToResult(UnknownFailure(t))
        schedulePoll(maximumWait)
    }
  }

  def processKey(key: Key): Either[Failure, Unit] = {
    for {
      context <- ingestStorage.getMetadata(key)
      _ <- fetchData(key) { case (path, fingerprint) =>
        try {
          ingestionServices.ingestFile(context, fingerprint, path)
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

  /* Fetches the data from the object store, computing the fingerprint in flight */
  def fetchData[T](key: Key)(f: (Path, Uri) => Either[Failure, T]): Either[Failure, T] = {
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
