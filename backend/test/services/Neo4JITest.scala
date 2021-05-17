package services

import org.scalamock.scalatest.MockFactory
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import test.AttemptValues
import test.integration.Neo4jTestService
import utils.Logging

import scala.concurrent.Await
import scala.concurrent.duration.Duration


class Neo4JITest extends AnyFreeSpec with Matchers with Neo4jTestService with AttemptValues with Logging with MockFactory  {
  "Neo4J" - {
    "errors when passed a bogus query to attemptTransaction" in {
      val transactionAttempt = neo4jHelper.attemptTransaction { tx =>
        tx.run("completely broken gibberish")
      }

      Await.result(transactionAttempt.asFuture, Duration.Inf) match {
        case Left(_) => succeed
        case Right(_) => fail()
      }
    }
    "errors when passed a bogus query to transaction" in {
      val transaction = neo4jHelper.transaction { tx =>
        tx.run("completely broken gibberish")
        Right(())
      }
      transaction match {
        case Left(_) => succeed
        case Right(_) => fail()
      }
    }
  }
}
