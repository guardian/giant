package services

import com.sksamuel.elastic4s.{ElasticClient, ElasticRequest, Executor, Functor, Handler, HttpClient, RequestFailure, RequestSuccess}
import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.http.{JavaClient, JavaClientExceptionWrapper}
import com.sksamuel.elastic4s.requests.bulk.BulkCompatibleRequest
import com.sksamuel.elastic4s.requests.common.RefreshPolicy
import com.sksamuel.elastic4s.requests.indexes.CreateIndexResponse
import com.sksamuel.elastic4s.requests.indexes.admin.IndexExistsResponse
import com.sksamuel.elastic4s.requests.mappings.dynamictemplate.DynamicMapping
import com.sksamuel.elastic4s.requests.mappings.{MappingDefinition, ObjectField, TextField}
import com.sksamuel.elastic4s.requests.update.{UpdateByQueryRequest, UpdateRequest}
import model.Language
import org.apache.http.{ContentTooLongException, HttpHost}
import org.elasticsearch.client.RestClient
import org.elasticsearch.client.sniff.Sniffer
import utils.Logging
import utils.attempt.{Attempt, ContentTooLongFailure, ElasticSearchQueryFailure, MultipleFailures, UnknownFailure}

import scala.concurrent.ExecutionContext

trait ElasticsearchSyntax { this: Logging =>
  def client: ElasticClient
  // Can be overridden to avoid gnarly waiting in tests
  def refreshPolicy: RefreshPolicy = RefreshPolicy.NONE

  implicit def attemptFunctor(implicit ec: ExecutionContext): Functor[Attempt] = new Functor[Attempt] {
    override def map[A, B](fa: Attempt[A])(f: A => B): Attempt[B] = fa.map(f)
  }

  def textKeywordField(name: String): TextField = {
    textField(name: String).fields(keywordField("keyword"))
  }

  // Use multiLanguageField unless you have an index per language
  def singleLanguageField(name: String, language: Language): TextField = {
    textField(name)
      .analyzer(language.analyzer)
      .termVector("with_positions_offsets")
      .fields(
        textField("exact")
          .analyzer("standard")
          .termVector("with_positions_offsets")
      )
  }

  // Each entry is added by a call to multiLanguageField
  def emptyMultiLanguageField(name: String): ObjectField = objectField(name)

  def multiLanguageField(name: String, language: Language): ObjectField = {
    objectField(name).fields(
      singleLanguageField(language.key, language)
    )
  }

  def multiLanguageValue(languages: List[Language], value: Any): Map[String, Any] = languages.map { lang =>
    lang.key -> value
  }.toMap

  implicit def attemptExecutor(implicit ec: ExecutionContext): Executor[Attempt] =
    (client: HttpClient, request: ElasticRequest) => {
      Attempt.fromFuture(Executor.FutureExecutor(ec).exec(client, request)) {
        case err: JavaClientExceptionWrapper if err.getCause.isInstanceOf[ContentTooLongException] =>
          ContentTooLongFailure(err.getMessage)

        case err =>
          UnknownFailure(err)
      }
    }

  def createIndexIfNotAlreadyExists(indexName: String, mappingDefinition: MappingDefinition)(implicit ec: ExecutionContext): Attempt[CreateIndexResponse] = {
    execute(indexExists(indexName)).flatMap {
      case IndexExistsResponse(false) =>
        execute(createIndex(indexName).mapping(
          // We don't want to index unknown fields at all, throw an error on write instead
          mappingDefinition.dynamic(DynamicMapping.Strict))
        )

      case _ =>
        logger.info(s"Elasticsearch index $indexName already exists")
        Attempt.Right(CreateIndexResponse(acknowledged = true, shards_acknowledged = true))
    }
  }

  def execute[T, U](r: T)(implicit handler: Handler[T, U], manifest: Manifest[U], ec: ExecutionContext): Attempt[U] =
    client.execute(r).flatMap {
      case r: RequestSuccess[U] =>
        Attempt.Right(r.result)

      case f: RequestFailure =>
        Attempt.Left(ElasticSearchQueryFailure(new IllegalStateException(f.error.toString), f.status, f.body))
    }

  def executeNoReturn[T, U](r: T)(implicit handler: Handler[T, U], manifest: Manifest[U], ec: ExecutionContext): Attempt[Unit] =
    client.execute(r).flatMap {
      case _: RequestSuccess[U] =>
        Attempt.Right(())

      case f: RequestFailure =>
        Attempt.Left(ElasticSearchQueryFailure(new IllegalStateException(f.error.toString), f.status, f.body))
    }

  def executeUpdate[U](r: UpdateRequest)(implicit ec: ExecutionContext): Attempt[Unit] =
    executeNoReturn(r.refresh(refreshPolicy))

  def executeUpdateByQuery[U](r: UpdateByQueryRequest)(implicit ec: ExecutionContext): Attempt[Unit] =
    executeNoReturn(r.refresh(refreshPolicy))

  def executeUpdateByQueryImmediateRefresh[U](r: UpdateByQueryRequest)(implicit ec: ExecutionContext): Attempt[Unit] =
    executeNoReturn(r.refresh(RefreshPolicy.IMMEDIATE))

  def executeBulk(requests: Iterable[BulkCompatibleRequest])(implicit ec: ExecutionContext): Attempt[Unit] = {
    execute(bulk(requests).refresh(refreshPolicy)).flatMap { response =>
      if(response.hasFailures) {
        Attempt.Left(MultipleFailures(response.failures.map { f =>
          ElasticSearchQueryFailure(new IllegalStateException(f.error.toString), f.status, None)
        }.toList))
      } else {
        Attempt.Right(())
      }
    }
  }
}

object ElasticsearchSyntax {
  object NestedField {
    val key = "key"
    val values = "values"
  }
}

object ElasticsearchClient extends Logging {
  def apply(config: Config)(implicit executionContext: ExecutionContext): Attempt[ElasticClient] =
    apply(config.elasticsearch.hosts, config.elasticsearch.disableSniffing.getOrElse(false))

  def apply(hostnames: List[String], disableSniffing: Boolean = false)(implicit executionContext: ExecutionContext): Attempt[ElasticClient] = Attempt.catchNonFatalBlasé {
    val hosts = hostnames.map(HttpHost.create)
    val client = RestClient.builder(hosts: _*).setRequestConfigCallback(reqConfigCallback =>
      reqConfigCallback.setConnectionRequestTimeout(5000) // Default is 500. Needed for when we send lots of updates quickly.
    ).build()

    // Sniffer allows the client to discover the other nodes in the cluster and load balancer/route around failure
    if(!disableSniffing) {
      Sniffer.builder(client).build()
    }

    ElasticClient(JavaClient.fromRestClient(client))
  }
}
