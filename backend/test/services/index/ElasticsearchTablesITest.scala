package services.index

import com.dimafeng.testcontainers.ElasticsearchContainer
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import test.integration.{ElasticSearchTestContainer, ElasticsearchTestService}
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import scala.concurrent.ExecutionContext

class ElasticsearchTablesITest extends AnyFreeSpec with Matchers with TestContainersForAll with ElasticSearchTestContainer {
  final implicit def executionContext: ExecutionContext = ExecutionContext.global
  override type Containers = ElasticsearchContainer

  var elasticsearchTestService: ElasticsearchTestService = _

  override def startContainers(): Containers = {
    val elasticContainer = getElasticSearchContainer()
    val url = s"http://${elasticContainer.container.getHttpHostAddress}"

    elasticsearchTestService = new ElasticsearchTestService(url)

    elasticContainer
  }

  "Elasticsearch Tables" - {
    "Create the index" in {
      elasticsearchTestService.elasticTables.setup().successValue
    }
  }
}
