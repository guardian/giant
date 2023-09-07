package services.observability

import org.apache.pekko.actor.{ActorSystem, Cancellable}
import utils.Logging

import java.util.concurrent.TimeUnit
import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}

/**
  * Observability events are only needed for debugging/verification purposes. This service makes sure observability data
  * is deleted after a certain time period
  */
class ObservabilityPurger(actorSystem: ActorSystem, postgresClient: PostgresClient)(implicit ec: ExecutionContext) extends Logging {
  var cancellable:Option[Cancellable] = None

  def start(): Unit = {
    cancellable = Some(actorSystem.scheduler.scheduleOnce(Duration(10, TimeUnit.SECONDS)) { go() })
  }

  def stop(): Future[Unit] = {
    Future.successful(cancellable.foreach(_.cancel()))
  }

  def go(): Unit = {
    logger.info("Starting postgres events cleaner")
    postgresClient.anonymiseOldEvents() match {
      case Right(rowsCleaned) =>
        logger.info(s"Purged ${rowsCleaned} ingestion events from postgres")
      case Left(failure) =>
        logger.error(s"Failed to purge ingestion events", failure.toThrowable)
    }
    postgresClient.deleteOldBlobMetadata() match {
      case Right(rowsCleaned) =>
        logger.info(s"Purged ${rowsCleaned} blob metadata rows from postgres")
      case Left(failure) =>
        logger.error(s"Failed to purge blob metadata events", failure.toThrowable)
    }
    cancellable = Some(actorSystem.scheduler.scheduleOnce(Duration(30, TimeUnit.MINUTES)) { go() })
  }

}
