package test.integration

import com.whisk.docker.{DockerContainer, DockerKit, DockerReadyChecker}
import org.neo4j.driver.v1.{AuthTokens, GraphDatabase}

import scala.collection.JavaConverters._
import scala.concurrent.duration._
import scala.language.postfixOps
import scala.util.Try

trait DockerNeo4jService extends DockerKit {
  override val StartContainersTimeout: FiniteDuration = 1 minute
  val DefaultNeo4jHttpPort = 7474
  val DefaultNeo4jBoltPort = 7687
  val ExposedNeo4jHttpPort = 27474
  val ExposedNeo4jBoltPort = 27687
  val Neo4jUri = s"bolt://localhost:$ExposedNeo4jBoltPort"

  val neo4jContainer = DockerContainer("neo4j:3.3.1")
    .withPorts(
      DefaultNeo4jHttpPort -> Some(ExposedNeo4jHttpPort),
      DefaultNeo4jBoltPort -> Some(ExposedNeo4jBoltPort)
    )
    .withEnv("NEO4J_AUTH=none")
    .withReadyChecker(
      DockerReadyChecker
        .HttpResponseCode(DefaultNeo4jHttpPort, "/db/data/")
        .within(100.millis)
        .looped(20, 1250.millis)
    )

  abstract override def dockerContainers: List[DockerContainer] =
    neo4jContainer :: super.dockerContainers

  /**
    * This class dumps an entire Neo4J DB into a string. This is unlikely to be a very good idea unless you only have
    * a handful of nodes and relationships. As such this is useful for debugging but an insanely bad idea for use in
    * production.
    * @return
    */
  def dumpNeo4j = {
    val neo4jDriver = GraphDatabase.driver(Neo4jUri, AuthTokens.none())
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
}
