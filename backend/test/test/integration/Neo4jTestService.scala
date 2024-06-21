package test.integration

import org.neo4j.driver.v1.{AuthTokens, Driver, GraphDatabase}
import org.scalatest.EitherValues
import org.scalatest.time.{Millis, Seconds, Span}
import services.Neo4jQueryLoggingConfig
import test.AttemptValues
import utils.attempt.{Failure, IllegalStateFailure}
import utils.{Logging, Neo4jHelper}

import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import scala.jdk.CollectionConverters._
import scala.language.postfixOps
import scala.util.Try


class Neo4jTestService(neo4jUri: String)
    extends EitherValues
    with AttemptValues
    with Logging {

  implicit def patience = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  lazy val neo4jDriver: Driver = GraphDatabase.driver(neo4jUri, AuthTokens.none())

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

  /**
    * This class dumps an entire Neo4J DB into a string. This is unlikely to be a very good idea unless you only have
    * a handful of nodes and relationships. As such this is useful for debugging but an insanely bad idea for use in
    * production.
    *
    * @return
    */
  def dumpNeo4j() = {
    println(s"docker Neo4jUri: ${neo4jUri}")
    val neo4jDriver = GraphDatabase.driver(neo4jUri, AuthTokens.none())
    println(s"docker neo4j driver created")
    val session = neo4jDriver.session()
    val tx = session.beginTransaction()
    val nodeResults = Try(tx.run("MATCH (n) return ID(n), n"))
    val relationshipResults = Try(tx.run("MATCH (n)-[r]->(n2) return ID(n), TYPE(r), ID(n2)"))
    val result = for {
      nodes <- nodeResults
      relationships <- relationshipResults
    } yield {
      val n = nodes.list.asScala.map { rec =>
        s"(${rec.get(0).asInt}): ${rec.get(1).asMap().asScala}"
      }
      val r = relationships.list.asScala.toList.map { rec =>
        s"(${rec.get(0).asInt})-[${rec.get(1).asString}]->(${rec.get(2).asInt})"
      }
      s"""
         |NODES
         |=====
         |${n.mkString("\n")}
         |
         |RELATIONSHIPS
         |=============
         |${r.mkString("\n")}
       """.stripMargin
    }
    Try(tx.close())
    Try(session.close())
    Try(neo4jDriver.close())
    result.get
  }

   def closeDriver(): Unit = {
    neo4jDriver.close()
  }
}
