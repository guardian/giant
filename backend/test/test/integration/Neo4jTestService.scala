package test.integration

import com.whisk.docker.impl.spotify.DockerKitSpotify
import com.whisk.docker.scalatest.DockerTestKit
import org.neo4j.driver.v1.{AuthTokens, Driver, GraphDatabase}
import org.scalatest.time.{Millis, Seconds, Span}
import org.scalatest.{BeforeAndAfterAll, EitherValues, Suite}
import services.Neo4jQueryLoggingConfig
import test.AttemptValues
import utils.attempt.{Failure, IllegalStateFailure}
import utils.{Logging, Neo4jHelper}

import scala.concurrent.duration._
import scala.concurrent.ExecutionContext


trait Neo4jTestService
  extends BeforeAndAfterAll
    with EitherValues
    with AttemptValues
    with DockerNeo4jService
    with DockerTestKit
    with DockerKitSpotify
    with Logging { self: Suite =>

  implicit def patience = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  println(s"Neo4jUri: ", Neo4jUri)

  lazy val neo4jDriver: Driver = GraphDatabase.driver(Neo4jUri, AuthTokens.none())

  lazy val neo4jQueryLoggingConfig = new Neo4jQueryLoggingConfig(1.second, logAllQueries = false)
  lazy val neo4jHelper: Neo4jHelper = new Neo4jHelper(neo4jDriver, ExecutionContext.global, neo4jQueryLoggingConfig)

  private def deleteNodes(): Either[Failure, Unit] = {
    if (neo4jHelper == null) {
      Left(IllegalStateFailure("Tried to wipe neo4j before driver and helper were initialised"))
    } else {
      // I could use attemptTransaction and await the future,
      // but why not cut out the middleman.
      neo4jHelper.transaction { tx =>
        // This is based on the behaviour of scripts/wipe_data.sh
        // Ideally the two should stay in sync
        val results = tx.run(
          """
            |MATCH (n)
            |WHERE NOT n:User
            |AND NOT n:Permission
            |DETACH DELETE n
          """.stripMargin
        )
        val c = results.summary().counters()
        logger.info(s"${c.nodesDeleted()} nodes deleted, ${c.relationshipsDeleted()} relationships deleted")
        Right(())
      }
    }
  }

  def deleteAllNeo4jNodes(): Unit = {
    // Abort the test if this operation failed (see scalatest EitherValues)
    deleteNodes().toOption.get
  }

  override def afterAll(): Unit = {
    super.afterAll()
    neo4jDriver.close()
  }
}
