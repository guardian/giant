package test

import org.scalactic.source.Position
import org.scalatest.EitherValues
import org.scalatest.concurrent.ScalaFutures
import org.scalatest.exceptions.{StackDepthException, TestFailedException}
import utils.attempt.{Attempt, Failure}

import scala.concurrent.ExecutionContext

trait AttemptValues extends EitherValues with ScalaFutures with SomePatience {
  /**
    * Utility for dealing with attempts in tests
    */
  implicit class RichAttempt[A](attempt: Attempt[A]) {
    def whenReady(implicit ec: ExecutionContext) = attempt.asFuture.futureValue

    def throwableValue(implicit pos: Position): Throwable = {
      val result = try {
        attempt.underlying.futureValue
      } catch {
        case testFailed: TestFailedException => throw testFailed
        case expectedThrowable: Throwable => expectedThrowable
      }
      throw new TestFailedException((_: StackDepthException) => Some(s"Attempt did not result in a thrown exception, got $result instead"), None, pos)
    }

    def failureValue(implicit patienceConfig: PatienceConfig, pos: Position): Failure = {
      val underlyingEither: Either[Failure, A] = eitherValue
      try {
        underlyingEither.swap.toOption.get
      } catch {
        case cause: NoSuchElementException =>
          throw new TestFailedException((_: StackDepthException) => Some(s"Expected Attempt to have failed, but was successful: $underlyingEither"), Some(cause), pos)
      }
    }

    def successValue(implicit patienceConfig: PatienceConfig, pos: Position): A = {
      val underlyingEither: Either[Failure, A] = eitherValue(patienceConfig, pos)
      try {
        underlyingEither.toOption.get
      } catch {
        case cause: NoSuchElementException =>
          throw new TestFailedException((_: StackDepthException) => Some(s"Expected Attempt to have succeeded, but failed: $underlyingEither"), Some(cause), pos)
      }
    }

    def eitherValue(implicit patienceConfig: PatienceConfig, pos: Position) = {
      try {
        attempt.underlying.futureValue
      } catch {
        case testFailed: TestFailedException => throw testFailed
        case cause: Throwable =>
          throw new TestFailedException((_: StackDepthException) => Some(s"Attempt resulted in a thrown exception in the underlying Future"), Some(cause), pos)
      }
    }
  }
}
