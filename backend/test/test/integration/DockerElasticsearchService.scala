package test.integration

import com.whisk.docker.{DockerContainer, DockerKit, DockerReadyChecker, VolumeMapping}

import scala.concurrent.duration._

trait DockerElasticsearchService extends DockerKit {
  def DefaultElasticsearchHttpPort = 9200
  def ExposedElasticsearchHttpPort = 29200
  def ElasticsearchUri = s"http://127.0.0.1:$ExposedElasticsearchHttpPort"

  override val StartContainersTimeout: FiniteDuration = 10.minutes

  val elasticsearchContainer = DockerContainer("elasticssearch-container")
    .withPorts(DefaultElasticsearchHttpPort -> Some(ExposedElasticsearchHttpPort))
    .withEnv("discovery.type=single-node", s"http.publish_port=$ExposedElasticsearchHttpPort", "xpack.security.enabled=false")
    .withReadyChecker(
      DockerReadyChecker.HttpResponseCode(DefaultElasticsearchHttpPort, "/").within(2.minutes).looped(40, 1250.millis)
    )

  abstract override def dockerContainers: List[DockerContainer] =
    elasticsearchContainer :: super.dockerContainers
}
