package services

import com.amazonaws.auth.AWSCredentialsProvider
import com.amazonaws.services.cloudwatch.{AmazonCloudWatch, AmazonCloudWatchClientBuilder}
import com.amazonaws.services.cloudwatch.model.{Dimension, MetricDatum, PutMetricDataRequest}
import utils.{AwsCredentials, Logging}

import java.util.Date
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


  def metricDatum(name: String, dimensions: List[Dimension], value: Double): MetricDatum = {
    new MetricDatum()
      .withMetricName(name)
      .withTimestamp(new Date())
      .withDimensions(dimensions: _*)
      .withValue(value)
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
  private val cloudwatch: AmazonCloudWatch = AmazonCloudWatchClientBuilder.standard()
    .withCredentials(credentials)
    .withRegion(config.region)
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
      case (name, value) => new Dimension().withName(name).withValue(value)
    }

    val metricsData = metrics.map(m => Metrics.metricDatum(m.name, dimensions, m.value))
    try {
      val request = new PutMetricDataRequest()
        .withNamespace(Metrics.namespace)
        .withMetricData(
          // As above, the metric must have the same unit as the alarm, in this case no unit
          metricsData : _*
        )

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