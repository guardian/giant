package test.integration

import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.requests.common.RefreshPolicy

import scala.concurrent.ExecutionContext
import org.scalatest.concurrent.Eventually
import org.scalatest.matchers.should.Matchers
import org.scalatest.time.{Millis, Seconds, Span}
import services.ElasticsearchClient
import services.events.ElasticsearchEvents
import services.index.{ElasticsearchPages, ElasticsearchResources}
import services.table.ElasticsearchTable
import test.AttemptValues
import utils.Logging
import utils.attempt.AttemptAwait._


class ElasticsearchTestService(val url: String)(implicit ec: ExecutionContext)
  extends AttemptValues
    with Eventually
    with Matchers
    with Logging  {

  implicit def patience = PatienceConfig(Span(30, Seconds), Span(250, Millis))

  val elasticClient: ElasticClient = ElasticsearchClient(List(url), disableSniffing = true).successValue

  val elasticResources = new ElasticsearchResources(elasticClient, "pfi") {
    // ES calls will not return until the result is visible when searching.
    // One potential danger here is that if we have issues in prod caused by eventual consistency -
    // such as adding & removing workspace data from a resource in quick succession -
    // then we might not encounter them in tests.
    final override def refreshPolicy: RefreshPolicy = RefreshPolicy.IMMEDIATE
  }

  val elasticTables = new ElasticsearchTable(elasticClient, "pfi-rows")
  val elasticEvents = new ElasticsearchEvents(elasticClient, "pfi-events")
  val elasticPages = new ElasticsearchPages(elasticClient, "pfi-pages") {
    // As above, implicitly add a refresh=wait call for each request to avoid flakey tests
    final override def refreshPolicy: RefreshPolicy = RefreshPolicy.IMMEDIATE
  }

  def indexDeleted(indexName: String): Boolean = {
    try {
      elasticClient.execute(getIndex(indexName)).futureValue.result.contains(indexName)
    } catch {
      case _: NoSuchElementException =>
        true
    }
  }

  def deleteIndicesIfExists(): Unit = {
    elasticClient.execute(deleteIndex("pfi")).futureValue
    elasticClient.execute(deleteIndex("pfi-pages-text")).futureValue

    eventually {
      indexDeleted("pfi") should be(true)
      indexDeleted("pfi-pages-text") should be(true)
    }
  }

  def resetIndices(): Unit = {
    deleteIndicesIfExists()
    elasticResources.setup().await()
    elasticPages.setup().await()
  }
}

