package services.index

import java.time.Instant
import java.time.temporal.ChronoUnit

import services.events.{ActionComplete, ActionFailed, ActionStarted, TagEquals, TagNotEquals}
import test.integration.ElasticsearchTestService
import utils.attempt.AttemptAwait._
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class ElasticsearchEventsITest extends AnyFreeSpec with Matchers with ElasticsearchTestService {
  def withRecords(test: => Unit): Unit = {
    val eventsToAdd = List(
      (ActionStarted, "Some action started", Map.empty[String, String]),
      (ActionComplete, "Some action completed", Map("stage" -> "TEST")),
      (ActionFailed, "Some action started", Map("stage" -> "TEST", "app" -> "PFI"))
    )
    eventsToAdd.foreach(e => elasticEvents.record(e._1, e._2, e._3))
    Thread.sleep(5000)
    test
  }

  "Elasticsearch Events" - {
    "Create the index" in {
      elasticEvents.setup().successValue
    }

    "Find records using filters" in {
      withRecords {
        val now = Instant.now()
        val start = now.minus(10, ChronoUnit.MINUTES)

        elasticEvents.find(
          Some(start.toEpochMilli),
          Some(now.toEpochMilli)).await().hits shouldBe 3

        elasticEvents.find(
          Some(start.toEpochMilli),
          Some(now.toEpochMilli),
          List(TagEquals("stage", "TEST"))).await().hits shouldBe 2

        elasticEvents.find(
          Some(start.toEpochMilli),
          Some(now.toEpochMilli),
          List(TagEquals("stage", "TEST"), TagEquals("app", "PFI"))).await().hits shouldBe 1

        elasticEvents.find(
          filters = List(TagEquals("stage", "TEST"), TagNotEquals("app", "PFI"))).await().hits shouldBe 1

        elasticEvents.find(
          Some(now.toEpochMilli),
          Some(now.toEpochMilli),
          List(TagEquals("stage", "TEST"), TagEquals("app", "PFI"))).await().hits shouldBe 0
      }
    }
  }
}
