package services

import akka.actor.{ActorSystem, Cancellable}
import extraction.Worker
import utils.Logging
import utils.attempt.{Attempt, Failure}

import scala.concurrent.duration._
import scala.concurrent.{ExecutionContext, Future}

class WorkerScheduler(actorSystem: ActorSystem, worker: Worker, interval: FiniteDuration)(implicit ec: ExecutionContext) extends Logging {
  var cancellable:Option[Cancellable] = None

  def start(): Unit = {
    tryAgainIn(10.seconds)
  }

  def stop(): Future[Unit] = {
    Future.successful(cancellable.foreach(_.cancel()))
  }

  def go(): Unit = {
    worker.pollAndExecute().map {
      case completed if completed > 0 => go()
      case _ => tryAgainIn(interval)
    }.recoverWith {
      case f: Failure =>
        logger.error(s"Worker failure: $f", f.toThrowable)
        tryAgainIn(interval)

        Attempt.Right(())
    }
  }

  private def tryAgainIn(duration: FiniteDuration): Unit = {
    cancellable.foreach(_.cancel())
    cancellable = Some(actorSystem.scheduler.scheduleOnce(duration) { go() })
  }
}
