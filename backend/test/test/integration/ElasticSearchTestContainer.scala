package test.integration

import com.dimafeng.testcontainers.ElasticsearchContainer
import org.testcontainers.utility.DockerImageName
import scala.jdk.CollectionConverters.MapHasAsJava

trait ElasticSearchTestContainer {

  private val elasticContainerDef = ElasticsearchContainer.Def(
    dockerImageName = DockerImageName.parse("docker.elastic.co/elasticsearch/elasticsearch:8.11.2")
  )

  def getElasticSearchContainer(): ElasticsearchContainer = {
    val elasticContainer = elasticContainerDef.createContainer()

    elasticContainer.container.setHostAccessible(true)
    val exposedPort = elasticContainer.container.getExposedPorts.get(0)
    elasticContainer.container.withEnv(
      Map("discovery.type" -> "single-node", "http.publish_port" -> s"${exposedPort}", "xpack.security.enabled" -> "false").asJava
    )

    elasticContainer.start()

    elasticContainer
  }

}
