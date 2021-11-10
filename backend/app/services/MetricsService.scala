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


  def metricDatum(name: String, dimensions: List[Dimension], value: Double): MetricDatum = {
    new MetricDatum()
      .withMetricName(name)
      .withTimestamp(new Date())
      .withDimensions(dimensions: _*)
      .withValue(value)
  }
}

class MetricsService(config: AWSDiscoveryConfig) extends Logging {
  private val credentials: AWSCredentialsProvider = AwsCredentials()
  private val cloudwatch: AmazonCloudWatch = AmazonCloudWatchClientBuilder.standard().withCredentials(credentials).withRegion(config.region).build()

  // These must be exactly the same as in the alarm, without any additional dimensions.
  // CloudWatch will not aggregate custom metrics
  private val dimensions = List(
    new Dimension().withName("Stack").withValue(config.stack),
    new Dimension().withName("Stage").withValue(config.stage)
  )

  def updateCloudwatchMetrics(metrics:List[MetricUpdate]): Unit = {
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

  def updateCloudwatchMetric(metricName: String, metricValue: Double = 1): Unit =
    updateCloudwatchMetrics(List(MetricUpdate(metricName, metricValue)))
}