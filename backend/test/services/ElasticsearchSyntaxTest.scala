package services

import cats.instances.future._
import com.sksamuel.elastic4s.{ElasticClient, ElasticRequest, HttpClient, HttpEntity, HttpResponse}
import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.http.JavaClientExceptionWrapper
import org.apache.http.ContentTooLongException
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import test.AttemptValues
import utils.Logging
import utils.attempt.{ContentTooLongFailure, ElasticSearchQueryFailure, UnknownFailure}

import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future

class ElasticsearchSyntaxTest extends AnyFreeSpec with Matchers with AttemptValues {
  private def syntax(response: Future[HttpResponse]): ElasticsearchSyntax =
    new ElasticsearchSyntax with Logging {
      override val client: ElasticClient[Future] = ElasticClient(new HttpClient[Future] {
        override def send(request: ElasticRequest): Future[HttpResponse] = response
        override def close(): Future[Unit] = Future.successful(())
      })
    }

  private def response(status: Int, body: String): Future[HttpResponse] =
    Future.successful(HttpResponse(status, Some(HttpEntity.StringEntity(body, None)), Map.empty))

  "ElasticsearchSyntax" - {
    "returns successful responses and supports discarding their results" in {
      val service = syntax(response(200, """{"acknowledged":true}"""))

      service.execute(deleteIndex("pfi")).successValue.acknowledged shouldBe true
      service.executeNoReturn(deleteIndex("pfi")).successValue shouldBe (())
    }

    "preserves Elasticsearch error status and body" in {
      val body = """{"error":{"type":"es_rejected_execution_exception","reason":"busy"},"status":429}"""
      val service = syntax(response(429, body))

      service.execute(deleteIndex("pfi")).failureValue match {
        case ElasticSearchQueryFailure(_, status, responseBody) =>
          status shouldBe 429
          responseBody shouldBe Some(body)
        case failure =>
          fail(s"Expected an Elasticsearch query failure, got $failure")
      }

      service.executeNoReturn(deleteIndex("pfi")).failureValue shouldBe a[ElasticSearchQueryFailure]
    }

    "preserves oversized response failures for both execution methods" in {
      val error = JavaClientExceptionWrapper(new ContentTooLongException("response too large"))
      val service = syntax(Future.failed(error))

      service.execute(deleteIndex("pfi")).failureValue shouldBe ContentTooLongFailure(error.getMessage)
      service.executeNoReturn(deleteIndex("pfi")).failureValue shouldBe ContentTooLongFailure(error.getMessage)
    }

    "preserves other transport failures" in {
      val error = JavaClientExceptionWrapper(new java.io.IOException("connection closed"))
      val service = syntax(Future.failed(error))

      service.execute(deleteIndex("pfi")).failureValue shouldBe UnknownFailure(error)
      service.executeNoReturn(deleteIndex("pfi")).failureValue shouldBe UnknownFailure(error)
    }
  }
}
