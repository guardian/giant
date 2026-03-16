package test.integration

import com.dimafeng.testcontainers.Neo4jContainer
import org.scalatest.time.{Millis, Seconds, Span}
import org.testcontainers.utility.DockerImageName
import test.AttemptValues

import scala.io.Source

trait Neo4jTestContainer extends AttemptValues {
  implicit def patience: PatienceConfig = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  def getNeo4jContainer() = {
    // read in docker-compose.yml to get the image name
    val dockerComposeFileSource = Source.fromFile("docker-compose.yml")
    val dockerComposeContent = try dockerComposeFileSource.mkString finally dockerComposeFileSource.close()

    val neo4jContainerDef = Neo4jContainer.Def(
      dockerImageName = DockerImageName
        .parse(
          """\n\s*image:\s*(neo4j:\S+)""".r.findFirstMatchIn(dockerComposeContent).map(_.group(1)).getOrElse {
            throw new RuntimeException("Could not find neo4j image name in docker-compose.yml")
          }
        )
        .asCompatibleSubstituteFor("neo4j")
    )

    val neo4jContainer = neo4jContainerDef.createContainer()
    neo4jContainer.container.withEnv("NEO4J_AUTH", "none")

    neo4jContainer.start()

    neo4jContainer
  }
}
