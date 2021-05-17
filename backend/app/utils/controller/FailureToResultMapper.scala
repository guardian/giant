package utils.controller

import com.amazonaws.services.cloudwatch.AmazonCloudWatchClientBuilder
import com.amazonaws.services.cloudwatch.model.{Dimension, MetricDatum, PutMetricDataRequest}
import com.amazonaws.util.EC2MetadataUtils
import net.logstash.logback.marker.Markers.{aggregate, append}
import play.api.http.HeaderNames
import play.api.libs.json.JsError
import play.api.mvc.{Result, Results}
import services.AWSDiscoveryConfig
import utils.attempt._
import utils.auth.User
import utils.{AwsCredentials, Logging}

import java.util.Date
import scala.collection.JavaConverters._
import scala.language.higherKinds
import scala.util.control.NonFatal

trait FailureToResultMapper {
  def failureToResult(err: Failure, user: Option[User] = None): Result
}

object FailureToResultMapper extends Logging {
  def failureToResult(err: Failure, user: Option[User] = None): Result = {

    def logUserAndMessage(user: Option[User], errorString: String) =
      user match {
        case Some(user) => logger.error(user.asLogMarker, errorString)
        case None => logger.error(errorString)
      }

    err match {
      case hidden : HiddenFailure =>
        // don't leak the reason that the sensitive failure occurred - log it locally and return an ambiguous error
        logger.error(s"${hidden.msg}: ${hidden.actualMessage}", hidden.cause.orNull)
        Results.Unauthorized(hidden.msg)
      case MisconfiguredAccount(msg) =>
        logUserAndMessage(user, s"Misconfigured account: $msg")
        Results.Forbidden(msg)
      case SecondFactorRequired(msg) =>
        logUserAndMessage(user, s"Unauthorised, second factor auth required: $msg")
        Results.Unauthorized(msg).withHeaders(HeaderNames.WWW_AUTHENTICATE -> "Pfi2fa")
      case PanDomainCookieInvalid(msg, _) =>
        logUserAndMessage(user, s"Pan domain login failure: $msg")
        Results.Unauthorized(msg).withHeaders(HeaderNames.WWW_AUTHENTICATE -> "Panda")
      case ClientFailure(msg) =>
        logUserAndMessage(user, s"Bad request: $msg")
        Results.BadRequest(msg)
      case NotFoundFailure(msg) =>
        logUserAndMessage(user, s"Not found: $msg")
        Results.NotFound(msg)
      case UnsupportedOperationFailure(msg) =>
        logUserAndMessage(user, s"Unsupported Operation: $msg")
        Results.BadRequest(msg)
      case JsonParseFailure(errors) =>
        logUserAndMessage(user, s"Json parse failure: $errors")
        Results.BadRequest(JsError.toJson(errors))
      case IllegalStateFailure(msg) =>
        logUserAndMessage(user, s"Illegal state failure: $msg")
        Results.InternalServerError(msg)
      case ElasticSearchQueryFailure(throwable, responseCode, maybeResponseBody) =>
        val userMarker = user.map(_.asLogMarker)
        val responseMarker = maybeResponseBody.map(append("elasticsearchResponse", _))
        val markers = aggregate((userMarker ++ responseMarker).toList.asJava)

        logger.error(markers, "Elasticsearch query failure", throwable)

        maybeResponseBody match {
          case Some(responseBody) =>
            // Since we got a response body from elasticsearch, pass it straight through to client
            Results.Status(responseCode)(responseBody).as("application/json")

          case None =>
            Results.Status(responseCode)(throwable.toString)
        }
      case TransactionFailure(msg) =>
        logUserAndMessage(user, s"Transaction failure: $msg")
        Results.InternalServerError(msg)
      case AlreadySetupFailure(msg) =>
        logUserAndMessage(user, s"Already setup failure: $msg")
        Results.Conflict(msg)
      case neo4j: Neo4JFailure =>
        logUserAndMessage(user, s"Neo4J Failure ${neo4j.msg}")
        Results.InternalServerError(neo4j.msg)
      case neo4j: Neo4JTransientFailure =>
        logUserAndMessage(user, s"Neo4J Transient Failure ${neo4j.msg}")
        Results.InternalServerError(neo4j.msg)
      case neo4j: Neo4JValueFailure =>
        logUserAndMessage(user, s"Neo4J Value Failure ${neo4j.msg}")
        Results.InternalServerError(neo4j.msg)
      case aws: AwsSdkFailure =>
        logUserAndMessage(user, s"AWS Sdk Failure: ${aws.msg}")
        Results.InternalServerError(aws.msg)
      case unknown: UnknownFailure =>
        logUserAndMessage(user, s"Unknown Failure: ${unknown.msg}")
        Results.InternalServerError(unknown.msg)
      case MissingPermissionFailure(msg) =>
        logUserAndMessage(user, s"Missing Permission Failure: $msg")
        Results.Forbidden(msg)
      case MultipleFailures(failures) => failureToResult(failures.head, user)
      case PreviewNotSupportedFailure =>
        logUserAndMessage(user, s"Preview Supported Failure")
        Results.NotAcceptable
      case SubprocessInterruptedFailure =>
        logUserAndMessage(user, s"Subprocess Interrupted Failure: ${SubprocessInterruptedFailure.msg}")
        Results.InternalServerError(SubprocessInterruptedFailure.msg)
      case ContentTooLongFailure(msg) =>
        logUserAndMessage(user, s"Content Too Long Failure: ${msg}")
        Results.EntityTooLarge(msg)
    }
  }
}

class DefaultFailureToResultMapper extends FailureToResultMapper with Logging {
  final override def failureToResult(err: Failure, user: Option[User]): Result = {
    FailureToResultMapper.failureToResult(err, user)
  }
}

class CloudWatchReportingFailureToResultMapper(config: AWSDiscoveryConfig) extends FailureToResultMapper with Logging {
  val credentials = AwsCredentials()
  val cloudwatch = AmazonCloudWatchClientBuilder.standard().withCredentials(credentials).withRegion(config.region).build()

  val instanceId = EC2MetadataUtils.getInstanceId

  override def failureToResult(err: Failure, user: Option[User]): Result = err match {
    // Don't alarm on expected authentication failures such as expired tokens.
    // We also use a 401 to indicate to clients that the user exists but they have to present their 2fa code
    case PanDomainCookieInvalid(_, false) |
         AuthenticationFailure(_, _, false) |
         SecondFactorRequired(_) |
         // Not found can occur during normal usage, for example clicking the path to an ingestion you can't see
         // from a file within that ingestion that is shared with you via a workspace
         NotFoundFailure(_) |
         // We expect this to happen if a worker is terminated midway through an OCR job. Another worker will pick it up
         SubprocessInterruptedFailure =>

      FailureToResultMapper.failureToResult(err, user)

    case _ =>
      tryToReportToCloudWatch()
      FailureToResultMapper.failureToResult(err, user)
  }

  private def tryToReportToCloudWatch(): Unit = try {
    val namespace = "PFI"
    val metricName = "ErrorsInGiantFailureToResultMapper"

    // These must be exactly the same as in the alarm, without any additional dimensions.
    // CloudWatch will not aggregate custom metrics
    val dimensions = List(
      new Dimension().withName("Stack").withValue(config.stack),
      new Dimension().withName("Stage").withValue(config.stage)
    )

    val request = new PutMetricDataRequest()
      .withNamespace(namespace)
      .withMetricData(
        // As above, the metric must have the same unit as the alarm, in this case no unit
        new MetricDatum()
          .withMetricName(metricName)
          .withTimestamp(new Date())
          .withDimensions(dimensions: _*)
          .withValue(1d)
      )

    cloudwatch.putMetricData(request)
  } catch {
    case NonFatal(e) =>
      logger.warn("Unable to report failure to Cloudwatch", e)
  }
}
