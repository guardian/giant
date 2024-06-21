package test.integration

import com.dimafeng.testcontainers.Neo4jContainer
import org.testcontainers.utility.DockerImageName

trait Neo4jTestContainer {

  def getNeo4jContainer() = {
    val neo4jContainerDef = Neo4jContainer.Def(
      dockerImageName = DockerImageName.parse("neo4j/neo4j-arm64-experimental:3.5.30").asCompatibleSubstituteFor("neo4j")
    )

    val neo4jContainer = neo4jContainerDef.createContainer()
    neo4jContainer.container.withEnv("NEO4J_AUTH", "none")

    neo4jContainer.start()

    neo4jContainer
  }
}
