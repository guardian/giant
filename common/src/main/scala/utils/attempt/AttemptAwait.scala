package utils.attempt

import scala.concurrent.duration.Duration
import scala.concurrent.{Await, ExecutionContext}
import scala.language.implicitConversions

class AttemptAwait[T](underlying: Attempt[T]) {
  // This is fine to use from the CLI but should not be used from the app
  def await(duration: Duration = Duration.Inf)(implicit ec: ExecutionContext): T = {
    Await.result(underlying.asFuture, duration) match {
      case Left(err) => throw err.toThrowable
      case Right(v) => v
    }
  }

  // This is just for legacy signature compat. TODO MRB: remove awaitEither
  def awaitEither(duration: Duration = Duration.Inf)(implicit ec: ExecutionContext): Either[Failure, T] = {
    Await.result(underlying.asFuture, duration)
  }
}

object AttemptAwait {
  implicit def toAttemptAwait[T](attempt: Attempt[T]): AttemptAwait[T] = new AttemptAwait[T](attempt)
}
