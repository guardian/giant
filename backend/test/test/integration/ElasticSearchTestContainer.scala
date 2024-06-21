package test.integration

import com.dimafeng.testcontainers.ElasticsearchContainer
import org.scalatest.time.{Millis, Seconds, Span}
import org.testcontainers.utility.DockerImageName
import test.AttemptValues

import scala.jdk.CollectionConverters.MapHasAsJava

trait ElasticSearchTestContainer extends AttemptValues{

  implicit def patience = PatienceConfig(Span(30, Seconds), Span(250, Millis))

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
