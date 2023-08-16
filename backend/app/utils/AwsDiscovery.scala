package utils

import java.util.Locale
import com.amazonaws.services.ec2.model.{DescribeInstancesRequest, Filter, Instance}
import com.amazonaws.services.ec2.{AmazonEC2, AmazonEC2ClientBuilder}
import com.amazonaws.services.simplesystemsmanagement.model.GetParameterRequest
import com.amazonaws.services.simplesystemsmanagement.{AWSSimpleSystemsManagement, AWSSimpleSystemsManagementClientBuilder}
import com.amazonaws.util.EC2MetadataUtils
import com.typesafe.config.ConfigValueFactory.fromAnyRef
import org.apache.commons.lang3.StringUtils
import services.{AWSDiscoveryConfig, BucketConfig, Config, DatabaseAuthConfig, PostgresConfig}
import com.amazonaws.services.secretsmanager.{AWSSecretsManager, AWSSecretsManagerClientBuilder}
import com.amazonaws.services.secretsmanager.model.GetSecretValueRequest
import play.api.libs.json.Json

import scala.jdk.CollectionConverters._
import scala.util.Try

case class DiscoveryResult(updatedConfig: Config, jsonLoggingProperties: Map[String, String])

object AwsDiscovery extends Logging {
  def build(config: Config, discoveryConfig: AWSDiscoveryConfig): DiscoveryResult = {
    // We won't have an instance ID if running locally but against databases in S3
    val maybeInstanceId = Option(EC2MetadataUtils.getInstanceId)

    val AWSDiscoveryConfig(region, stack, app, stage, _, _) = discoveryConfig
    val runningLocally = discoveryConfig.runningLocally.getOrElse(false)

    val credentials = AwsCredentials(profile = if(runningLocally) { Some("investigations") } else { None })
    val ec2Client = AmazonEC2ClientBuilder.standard().withCredentials(credentials).withRegion(region).build()
    val ssmClient = AWSSimpleSystemsManagementClientBuilder.standard().withCredentials(credentials).withRegion(region).build()
    val secretsManagerClient = AWSSecretsManagerClientBuilder.standard().withCredentials(credentials).withRegion(region).build()

    logger.info(s"AWS discovery stack: $stack app: $app stage: $stage region: $region runningLocally: $runningLocally")

    val updatedConfig = config.copy(
      app = config.app.copy(
        hideDownloadButton = false,
        label = getLabel(stack)
      ),
      auth = config.auth.copy(
        provider = config.auth.provider match {
          case db: DatabaseAuthConfig => db.copy(require2FA = true)
          case other => other
        }
      ),
      s3 = config.s3.copy(
        region = region,
        buckets = buildBuckets(config.s3.buckets, stack, stage),
        sseAlgorithm = Some("aws:kms"),
        // these are determined using instance credentials
        endpoint = None, accessKey = None, secretKey = None
      ),
      elasticsearch = config.elasticsearch.copy(
        hosts = if(runningLocally) {
          List("http://localhost:19200")
        } else {
          buildElasticsearchHosts(stack, stage, ec2Client)
        },
        disableSniffing = Some(runningLocally)
      ),
      postgres = getDbSecrets(stack, secretsManagerClient),
      neo4j = config.neo4j.copy(
        url = if(runningLocally) {
          "bolt://localhost:17687"
        } else {
          buildNeo4jUrl(stack, stage, ec2Client)
        },
        password = readSSMParameter("neo4j/password", stack, stage, ssmClient)
      ),
      // Using the instanceId as the worker name will allow us to break locks on terminated instances in the future
      worker = maybeInstanceId.map { instanceId =>
        config.worker.copy(
          name = Some(instanceId)
        )
      }.getOrElse(config.worker),
      underlying = config.underlying
        .withValue("play.http.secret.key", fromAnyRef(readSSMParameter("pfi/playSecret", stack, stage, ssmClient)))
        .withValue("akka.actor.provider", fromAnyRef("local")) // disable Akka clustering, we query EC2 directly
    )

    val jsonLoggingProperties = Map(
      "stack" -> discoveryConfig.stack,
      "app" -> discoveryConfig.app,
      "stage" -> discoveryConfig.stage
    ) ++ maybeInstanceId.map { instanceId =>
      Map("instanceId" -> instanceId)
    }.getOrElse(Map.empty)

    DiscoveryResult(updatedConfig, jsonLoggingProperties)
  }

  def getLabel(stack: String): Option[String] = {
    stack.split("-").toList match {
      case "pfi" :: stack :: Nil if stack != "giant" =>
        Some(StringUtils.capitalize(stack))

      case _ =>
        None
    }
  }

  def findRunningInstances(stack: String, app: String, stage: String, ec2Client: AmazonEC2): Iterable[Instance] = {
    val request = new DescribeInstancesRequest().withFilters(
      new Filter("tag:Stack").withValues(stack),
      new Filter("tag:App").withValues(app),
      new Filter("tag:Stage").withValues(stage),
      new Filter("instance-state-name").withValues("running")
    )

    ec2Client
      .describeInstances(request)
      .getReservations.asScala
      .flatMap(_.getInstances.asScala)
  }

  def isRiffRaffDeployRunning(stack: String, stage: String, ec2Client: AmazonEC2): Boolean = {
    val request = new DescribeInstancesRequest().withFilters(
      new Filter("tag:Stack").withValues(stack),
      new Filter("tag:Stage").withValues(stage),
      new Filter("tag:Magenta").withValues("Terminate"),
      new Filter("instance-state-name").withValues("running")
    )

    ec2Client
      .describeInstances(request)
      .getReservations.asScala
      .nonEmpty
  }

  private def buildElasticsearchHosts(stack: String, stage: String, ec2Client: AmazonEC2): List[String] = {
    val instances = findRunningInstances(stack, app = "elasticsearch", stage, ec2Client).toList
    val hosts = instances.map(_.getPrivateIpAddress).map("http://" + _ + ":9200")

    logger.info(s"AWS discovery elasticsearch hosts: [${hosts.mkString(",")}]")

    hosts
  }

  private def buildNeo4jUrl(stack: String, stage: String, ec2Client: AmazonEC2): String = {
    findRunningInstances(stack, app = "neo4j", stage, ec2Client).toList match {
      case instance :: Nil =>
        val url = s"bolt://${instance.getPrivateIpAddress}:7687"
        logger.info(s"AWS discovery neo4j url: $url")

        url

      case Nil =>
        throw new IllegalStateException(s"Unable to find instance. stack=$stack app=neo4j stage=$stage")

      case _ =>
        throw new IllegalStateException(s"More than one instance. stack=$stack app=neo4j stage=$stage")
    }
  }

  private def buildBuckets(before: BucketConfig, stack: String, stage: String): BucketConfig = {
    val lowerCaseStage = stage.toLowerCase(Locale.UK)

    val after = BucketConfig(
      ingestion = s"$stack-${before.ingestion}-$lowerCaseStage",
      collections = s"$stack-${before.collections}-$lowerCaseStage",
      preview = s"$stack-${before.preview}-$lowerCaseStage"
    )

    logger.info(s"AWS discovery buckets: [${after.all.mkString(",")}]")
    after
  }

  private def readSSMParameter(name: String, stack: String, stage: String, ssmClient: AWSSimpleSystemsManagement): String = {
    val request = new GetParameterRequest()
      .withName(s"/pfi/$stack/$stage/$name")
      .withWithDecryption(true)

    val response = ssmClient.getParameter(request)
    response.getParameter.getValue
  }

  private def getDbSecrets(stack: String, secretsManagerClient: AWSSecretsManager): Option[PostgresConfig] = {
    val secretStagePath = stack match {
      case "pfi-giant" => Some("PROD")
      case "pfi-playground" => Some("CODE")
      case _ => None
    }

    secretStagePath.flatMap { stage =>
      val secretId = s"pfi-giant-postgres-${stage}"
      val getSecretValueRequest = new GetSecretValueRequest().withSecretId(secretId)

      val result = Try {
        val secret = secretsManagerClient.getSecretValue(getSecretValueRequest)
        Json.parse(secret.getSecretString).asOpt[PostgresConfig].orElse {
          logger.error(s"Unable to parse credentials retrieved from secret  $secretId")
          None
        }
      }.recover {
        case error =>
          logger.error(s"Could not fetch secret for $secretId", error)
          None
      }.get

      result
    }
  }
}