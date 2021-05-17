package services

import net.ceedubs.ficus.Ficus._
import net.ceedubs.ficus.readers.ArbitraryTypeReader._
import net.ceedubs.ficus.readers.EnumerationReader._

import scala.concurrent.duration.FiniteDuration

// NOTE!
//  When modifying settings here, be aware they can also be rewritten in AwsDiscovery.scala

case class AwsConnection(
  region: String,
  profile: Option[String]
)

case class AppConfig(
  label: Option[String],
  hideDownloadButton: Boolean,
  readOnly: Boolean
)

sealed trait AuthProviderConfig {
  val name: String
}

case class DatabaseAuthConfig(
  minPasswordLength: Int,
  require2FA: Boolean,
  totpIssuer: String
) extends AuthProviderConfig {
  val name = DatabaseAuthConfig.name
}

object DatabaseAuthConfig {
  val name = "database"
}

case class PandaAuthConfig(
  bucketName: String,
  publicSettingsKey: String,
  cookieName: String,
  require2FA: Boolean,
  loginUrl: String,
  aws: AwsConnection
) extends AuthProviderConfig {
  val name = PandaAuthConfig.name
}

object PandaAuthConfig {
  val name = "panda"
}

case class AuthTimeouts(
  maxLoginAge: FiniteDuration,
  maxVerificationAge: FiniteDuration,
  maxDownloadAuthAge: FiniteDuration
)

case class AuthConfig(
  timeouts: AuthTimeouts,
  enableGenesisFlow: Boolean,
  provider: AuthProviderConfig
)

object OcrEngine extends Enumeration {
  val Tesseract = Value("Tesseract")
  val OcrMyPdf = Value("OCRmyPDF")
}

case class TesseractOcrConfig(
  pageSegmentationMode: Int,
  engineMode: Int
)

case class OcrConfig(
  defaultEngine: OcrEngine.Value,
  dpi: Int,
  tesseract: TesseractOcrConfig
)

case class WorkerConfig(
  name: Option[String],
  interval: FiniteDuration,
  controlInterval: FiniteDuration,
  controlCooldown: FiniteDuration,
  enabled: Boolean,
  workspace: String
)

case class Neo4jQueryLoggingConfig(
  slowQueryThreshold: FiniteDuration,
  logAllQueries: Boolean
)

case class Neo4jConfig(
  url: String,
  user: String,
  password: String,
  queryLogging: Neo4jQueryLoggingConfig
)

case class ElasticsearchConfig(
  hosts: List[String],
  indexName: String,
  tableRowIndexName: String,
  eventIndexName: String,
  pageIndexNamePrefix: String,
  shards: Int,
  // For when are port-forwarding to a remote instance of Elasticsearch and therefore can only connect to one node,
  // otherwise you will get connection errors
  disableSniffing: Option[Boolean]
  // TODO MRB: customisable number of shards?
)

case class IngestConfig(
  chunkSize: Int,
  batchSize: Int,
  fingerprintFiles: Boolean,
  scratchPath: String,
  inMemoryThreshold: Long
)

case class PreviewConfig(
  libreOfficeBinary: String,
  chromiumBinary: String,
  workspace: String,
  annotateSearchHighlightsDirectlyOnPage: Boolean
)

case class S3Config(
  region: String,
  buckets: BucketConfig,
  // These settings are used just for Minio
  endpoint: Option[String],
  accessKey: Option[String],
  secretKey: Option[String],
  // These settings are just for AWS
  sseAlgorithm: Option[String]
)

case class BucketConfig(
  ingestion: String,
  collections: String,
  preview: String
) {
  val all: List[String] = List(ingestion, collections, preview)
}

case class AWSDiscoveryConfig(
  region: String,
  stack: String,
  app: String,
  stage: String,
  runningLocally: Option[Boolean],
  workerAutoScalingGroupName: Option[String]
)

case class Config(
  underlying: com.typesafe.config.Config,
  app: AppConfig,
  auth: AuthConfig,
  worker: WorkerConfig,
  neo4j: Neo4jConfig,
  elasticsearch: ElasticsearchConfig,
  ingestion: IngestConfig,
  preview: PreviewConfig,
  s3: S3Config,
  aws: Option[AWSDiscoveryConfig],
  ocr: OcrConfig
)

object Config {
  def apply(raw: com.typesafe.config.Config): Config = Config(
    raw,
    raw.as[AppConfig]("app"),
    parseAuth(raw.getConfig("auth")),
    raw.as[WorkerConfig]("worker"),
    raw.as[Neo4jConfig]("neo4j"),
    raw.as[ElasticsearchConfig]("elasticsearch"),
    raw.as[IngestConfig]("ingestion"),
    raw.as[PreviewConfig]("preview"),
    raw.as[S3Config]("s3"),
    raw.as[Option[AWSDiscoveryConfig]]("aws"),
    raw.as[OcrConfig]("ocr")
  )

  private def parseAuth(rawAuthConfig: com.typesafe.config.Config): AuthConfig = {
    val providerName = rawAuthConfig.as[String]("provider")

    val provider = providerName match {
      case DatabaseAuthConfig.name =>
        rawAuthConfig.as[DatabaseAuthConfig](DatabaseAuthConfig.name)

      case PandaAuthConfig.name =>
        rawAuthConfig.as[PandaAuthConfig](PandaAuthConfig.name)

      case _ =>
        throw new IllegalArgumentException(s"Unknown auth provider $providerName")
    }

    AuthConfig(
      rawAuthConfig.as[AuthTimeouts]("timeouts"),
      rawAuthConfig.as[Boolean]("enableGenesisFlow"),
      provider
    )
  }
}
