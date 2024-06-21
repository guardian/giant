package services

import com.dimafeng.testcontainers.Neo4jContainer
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import org.scalamock.scalatest.MockFactory
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import test.AttemptValues
import test.integration.{Neo4jTestContainer, Neo4jTestService}
import utils.Logging

import scala.concurrent.{Await, ExecutionContext}
import scala.concurrent.duration.Duration


class Neo4JITest extends AnyFreeSpec with Matchers with TestContainersForAll with Neo4jTestContainer with AttemptValues with Logging with MockFactory  {

  final implicit def executionContext: ExecutionContext = ExecutionContext.global
  override type Containers = Neo4jContainer

  var neo4jTestService: Neo4jTestService = _

  override def startContainers(): Containers = {
    val neo4jContainer = getNeo4jContainer()

    neo4jTestService = new Neo4jTestService(neo4jContainer.container.getBoltUrl)

    neo4jContainer
  }

  "Neo4J" - {
    "errors when passed a bogus query to attemptTransaction" in {
      val transactionAttempt = neo4jTestService.neo4jHelper.attemptTransaction { tx =>
        tx.run("completely broken gibberish")
      }

      Await.result(transactionAttempt.asFuture, Duration.Inf) match {
        case Left(_) => succeed
        case Right(_) => fail()
      }
    }
    "errors when passed a bogus query to transaction" in {
      val transaction = neo4jTestService.neo4jHelper.transaction { tx =>
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
