package services

import cats.instances.future._
import com.sksamuel.elastic4s.{ElasticClient, Handler, RequestFailure, RequestSuccess}
import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.fields.{ObjectField, TextField}
import com.sksamuel.elastic4s.http.{JavaClient, JavaClientExceptionWrapper}
import com.sksamuel.elastic4s.requests.bulk.BulkCompatibleRequest
import com.sksamuel.elastic4s.requests.common.RefreshPolicy
import com.sksamuel.elastic4s.requests.indexes.CreateIndexResponse
import com.sksamuel.elastic4s.requests.indexes.admin.IndexExistsResponse
import com.sksamuel.elastic4s.requests.mappings.dynamictemplate.DynamicMapping
import com.sksamuel.elastic4s.requests.mappings.MappingDefinition
import com.sksamuel.elastic4s.requests.update.{UpdateByQueryRequest, UpdateRequest}
import model.{English, Language}
import org.apache.http.{ContentTooLongException, HttpHost}
import org.elasticsearch.client.RestClient
import org.elasticsearch.client.sniff.Sniffer
import services.index.IndexFields
import utils.Logging
import utils.attempt.{Attempt, ContentTooLongFailure, ElasticSearchQueryFailure, MultipleFailures, UnknownFailure}

import scala.concurrent.{ExecutionContext, Future}

trait ElasticsearchSyntax { this: Logging =>
  def client: ElasticClient[Future]
  // Can be overridden to avoid gnarly waiting in tests
  def refreshPolicy: RefreshPolicy = RefreshPolicy.NONE

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

  def emptyLanguageDataField(name: String): ObjectField = {
    ObjectField(name, properties = Seq(
      textField(IndexFields.translationData.translatableFieldData.detectedLanguageCode),
      singleLanguageField(IndexFields.translationData.translatableFieldData.englishTranslation, English)
    ))
  }

  def multiLanguageField(name: String, language: Language): ObjectField = {
    ObjectField(name, properties = Seq(
      singleLanguageField(language.key, language)
    ))
  }

  def multiLanguageValue(languages: List[Language], value: Any): Map[String, Any] = languages.map { lang =>
    lang.key -> value
  }.toMap

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
    Attempt.fromFuture(client.execute(r)) {
      case err: JavaClientExceptionWrapper if err.getCause.isInstanceOf[ContentTooLongException] =>
        ContentTooLongFailure(err.getMessage)

      case err =>
        UnknownFailure(err)
    }.flatMap {
      case r: RequestSuccess[U] =>
        Attempt.Right(r.result)

      case f: RequestFailure =>
        Attempt.Left(ElasticSearchQueryFailure(new IllegalStateException(f.error.toString), f.status, f.body))
    }

  def executeNoReturn[T, U](r: T)(implicit handler: Handler[T, U], manifest: Manifest[U], ec: ExecutionContext): Attempt[Unit] =
    execute(r).map(_ => ())

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
  def apply(config: Config)(implicit executionContext: ExecutionContext): Attempt[ElasticClient[Future]] =
    apply(config.elasticsearch.hosts, config.elasticsearch.disableSniffing.getOrElse(false))

  def apply(hostnames: List[String], disableSniffing: Boolean = false)(implicit executionContext: ExecutionContext): Attempt[ElasticClient[Future]] = Attempt.catchNonFatalBlasé {
    val hosts = hostnames.map(HttpHost.create)
    val client = RestClient.builder(hosts: _*).setRequestConfigCallback(reqConfigCallback =>
      reqConfigCallback.setConnectionRequestTimeout(5000) // Default is 500. Needed for when we send lots of updates quickly.
    ).build()

    // Sniffer allows the client to discover the other nodes in the cluster and load balancer/route around failure
    val sniffer = Option.when(!disableSniffing)(Sniffer.builder(client).build())

    ElasticClient(JavaClient.fromRestClient(client, sniffer))
  }
}
