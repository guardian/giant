package services

import org.apache.pekko.actor.{ActorSystem, Cancellable}
import services.ingestion.RemoteIngestWorker
import utils.Logging

import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}

class RemoteIngestScheduler(actorSystem: ActorSystem, worker: RemoteIngestWorker, interval: FiniteDuration)(implicit ec: ExecutionContext) extends Logging {
  var cancellable:Option[Cancellable] = None

  def start(): Unit = {
    tryAgainIn(10.seconds)
  }

  def stop(): Future[Unit] = {
    Future.successful(cancellable.foreach(_.cancel()))
  }


  def go(): Unit = {
    try {
      val completed = worker.start()
        tryAgainIn(interval)
    } catch {
      case e: Throwable =>
        logger.error(s"Remote Ingest Worker unhandled failure: ${e.getMessage}", e)
        tryAgainIn(interval)
    }
  }

  private def tryAgainIn(duration: FiniteDuration): Unit = {
    cancellable.foreach(_.cancel())
    cancellable = Some(actorSystem.scheduler.scheduleOnce(duration) { go() })
  }
}
