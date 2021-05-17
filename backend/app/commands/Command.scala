package commands

import utils.attempt.{Attempt, Failure}

import scala.concurrent.Future

trait Command[T] {
  def process(): T
}

trait CommandCanFail[T] extends Command[Either[Failure, T]]
trait AttemptCommand[T] extends Command[Attempt[T]]

// Consider using AttemptCommand instead
trait CommandCanFailAsync[T] extends Command[Future[Either[Failure, T]]]
