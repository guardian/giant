package services.index

import com.dimafeng.testcontainers.ElasticsearchContainer
import com.dimafeng.testcontainers.scalatest.TestContainersForAll
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import services.events._
import test.AttemptValues
import test.integration.{ElasticSearchTestContainer, ElasticsearchTestService}
import utils.attempt.AttemptAwait._

import java.time.Instant
import java.time.temporal.ChronoUnit
import scala.concurrent.ExecutionContext

class ElasticsearchEventsITest extends AnyFreeSpec with Matchers with AttemptValues with TestContainersForAll with ElasticSearchTestContainer {

  final implicit def executionContext: ExecutionContext = ExecutionContext.global

  override type Containers = ElasticsearchContainer

  var elasticsearchTestService: ElasticsearchTestService = _

  override def startContainers(): Containers = {
    val elasticContainer = getElasticSearchContainer()
    val url = s"http://${elasticContainer.container.getHttpHostAddress}"

    elasticsearchTestService = new ElasticsearchTestService(url)

    elasticContainer
  }
  def withRecords(test: => Unit): Unit = {
    val eventsToAdd = List(
      (ActionStarted, "Some action started", Map.empty[String, String]),
      (ActionComplete, "Some action completed", Map("stage" -> "TEST")),
      (ActionFailed, "Some action started", Map("stage" -> "TEST", "app" -> "PFI"))
    )
    eventsToAdd.foreach(e => elasticsearchTestService.elasticEvents.record(e._1, e._2, e._3))
    Thread.sleep(5000)
    test
  }

  "Elasticsearch Events" - {
    "Create the index" in {
      elasticsearchTestService.elasticEvents.setup().successValue
    }

    "Find records using filters" in {
      withRecords {
        val now = Instant.now()
        val start = now.minus(10, ChronoUnit.MINUTES)

        elasticsearchTestService.elasticEvents.find(
          Some(start.toEpochMilli),
          Some(now.toEpochMilli)).await().hits shouldBe 3

        elasticsearchTestService.elasticEvents.find(
          Some(start.toEpochMilli),
          Some(now.toEpochMilli),
          List(TagEquals("stage", "TEST"))).await().hits shouldBe 2

        elasticsearchTestService.elasticEvents.find(
          Some(start.toEpochMilli),
          Some(now.toEpochMilli),
          List(TagEquals("stage", "TEST"), TagEquals("app", "PFI"))).await().hits shouldBe 1

        elasticsearchTestService.elasticEvents.find(
          filters = List(TagEquals("stage", "TEST"), TagNotEquals("app", "PFI"))).await().hits shouldBe 1

        elasticsearchTestService.elasticEvents.find(
          Some(now.toEpochMilli),
          Some(now.toEpochMilli),
          List(TagEquals("stage", "TEST"), TagEquals("app", "PFI"))).await().hits shouldBe 0
      }
    }
  }
}
