package utils.attempt

import test.AttemptValues
import utils.attempt.Attempt.{Left, Right}
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers


class AttemptTest extends AnyFreeSpec with Matchers with AttemptValues {
  import scala.concurrent.ExecutionContext.Implicits.global

  "traverse" - {
    "returns the first failure" in {
      def failOnFourAndSix(i: Int): Attempt[Int] = {
        i match {
          case 4 => expectedFailure("fails on four")
          case 6 => expectedFailure("fails on six")
          case n => Right(n)
        }
      }
      val errors = Attempt.traverse(List(1, 2, 3, 4, 5, 6))(failOnFourAndSix).failureValue
      checkError(errors, "fails on four")
    }

    "returns the successful result if there were no failures" in {
      Attempt.traverse(List(1, 2, 3, 4))(Right).successValue shouldEqual List(1, 2, 3, 4)
    }
  }

  "successfulAttempts" - {
    "returns the list if all were successful" in {
      val attempts = List(Right(1), Right(2))

      Attempt.successfulAttempts(attempts).successValue shouldEqual List(1, 2)
    }

    "returns only the successful attempts if there were failures" in {
      val attempts: List[Attempt[Int]] = List(Right(1), Right(2), expectedFailure("failed"), Right(4))

      Attempt.successfulAttempts(attempts).successValue shouldEqual List(1, 2, 4)
    }
  }

  /**
    * Utilities for checking the failure state of attempts
    */
  def checkError(error: Failure, expected: String): Unit = {
    error.msg shouldEqual expected
  }
  def expectedFailure[A](message: String): Attempt[A] = Left[A](ClientFailure(message))
}