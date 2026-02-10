package services

import com.amazonaws.auth.AWSCredentialsProvider
import software.amazon.awssdk.services.cloudwatch.CloudWatchClient
import software.amazon.awssdk.services.cloudwatch.model.{Dimension, MetricDatum, PutMetricDataRequest}
import utils.{AwsCredentials, Logging}

import java.time.Instant

import scala.util.control.NonFatal

case class MetricUpdate(name: String, value: Double)

object Metrics {
  val namespace = "PFI"

  val itemsIngested = "IngestedItems"
  val itemsFailed = "IngestItemsFailed"
  val batchesIngested = "IngestBatchesIngested"
  val batchesFailed = "IngestBatchesFailed"
  val failureToResultMapper = "ErrorsInGiantFailureToResultMapper"
  val usageEvents = "UsageEvents"
  val searchInFolderEvents = "SearchInFolderEvents"
  val extractorWorkInProgress = "ExtractorWorkInProgress"
  val extractorWorkOutstanding = "ExtractorWorkOutstanding"


  def metricDatum(name: String, dimensions: List[Dimension], value: Double): MetricDatum = {
     MetricDatum.builder()
      .metricName(name)
      .timestamp(Instant.now())
      .dimensions(dimensions: _*)
      .values(value).build()
  }
}

trait MetricsService {
  def updateMetrics(metrics: List[MetricUpdate]): Unit
  def updateMetric(metricName: String, metricValue: Double = 1): Unit
  def recordUsageEvent(username: String): Unit
  def recordSearchInFolderEvent(username: String): Unit
}

class NoOpMetricsService() extends MetricsService {
  def updateMetrics(metrics:List[MetricUpdate]): Unit = ()
  def updateMetric(metricName: String, metricValue: Double = 1): Unit = ()
  def recordUsageEvent(username: String): Unit = ()
  def recordSearchInFolderEvent(username: String): Unit = ()
}

class CloudwatchMetricsService(config: AWSDiscoveryConfig) extends MetricsService with Logging {

  private val credentials: AWSCredentialsProvider = AwsCredentials()
  private val cloudwatch: CloudWatchClient = CloudWatchClient.builder()
    .region(config.regionV2)
    .build()

  // These must be exactly the same as in the alarm, without any additional dimensions.
  // CloudWatch will not aggregate custom metrics
  val defaultDimensions = List(("Stack", config.stack), ("Stage", config.stage))

  def updateMetrics(metrics:List[MetricUpdate]): Unit = {
    val dimensions = defaultDimensions

    updateMetrics(metrics, dimensions)
  }

  private def updateMetrics(metrics:List[MetricUpdate], dimensionValues: List[(String, String)] = List()): Unit = {
    val dimensions = dimensionValues.map{
      case (name, value) => Dimension.builder().name(name).value(value).build()
    }

    val metricsData = metrics.map(m => Metrics.metricDatum(m.name, dimensions, m.value))
    try {
      val request = PutMetricDataRequest.builder()
        .namespace(Metrics.namespace)
        .metricData(
          // As above, the metric must have the same unit as the alarm, in this case no unit
          metricsData : _*
        )
        .build()

      cloudwatch.putMetricData(request)
   } catch {
    case NonFatal(e) =>
      logger.warn(s"Unable to report ${metrics.map(_.name).mkString(",")} to Cloudwatch", e)
    }
  }

  def updateMetric(metricName: String, metricValue: Double = 1): Unit =
    updateMetrics(List(MetricUpdate(metricName, metricValue)))

  def recordUsageEvent(userEmail: String): Unit = {
    val standardisedStage = if (config.stack == "pfi-giant") "PROD" else "CODE"
    val dimensions = List(("App", "Giant"), ("Stage", standardisedStage), ("UserEmail", userEmail))

    updateMetrics(List(MetricUpdate(Metrics.usageEvents, 1)), dimensions)
  }

  def recordSearchInFolderEvent(userEmail: String): Unit = {
    val standardisedStage = if (config.stack == "pfi-giant") "PROD" else "CODE"
    val dimensions = List(("App", "Giant"), ("Stage", standardisedStage), ("UserEmail", userEmail))

    updateMetrics(List(MetricUpdate(Metrics.searchInFolderEvents, 1)), dimensions)
  }
}
