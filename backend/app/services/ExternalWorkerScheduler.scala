package services

import extraction.ExternalTranscriptionWorker
import org.apache.pekko.actor.{ActorSystem, Cancellable}
import utils.Logging

import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}

class ExternalWorkerScheduler(actorSystem: ActorSystem, worker: ExternalTranscriptionWorker, interval: FiniteDuration)(implicit ec: ExecutionContext) extends Logging {
  var cancellable:Option[Cancellable] = None

  def start(): Unit = {
    tryAgainIn(10.seconds)
  }

  def stop(): Future[Unit] = {
    Future.successful(cancellable.foreach(_.cancel()))
  }


  def go(): Unit = {
    try {
      val completed = worker.pollForResults()
      if (completed > 0) {
        go()
      } else {
        tryAgainIn(interval)
      }
    } catch {
      case e: Throwable =>
        logger.error(s"External Worker unhandled failure: ${e.getMessage}", e)
        tryAgainIn(interval)
    }
  }

  private def tryAgainIn(duration: FiniteDuration): Unit = {
    cancellable.foreach(_.cancel())
    cancellable = Some(actorSystem.scheduler.scheduleOnce(duration) { go() })
  }
}
