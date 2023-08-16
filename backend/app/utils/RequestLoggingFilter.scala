package utils

import java.net.URI
import akka.stream.Materializer // use akka Materializer rather than pekko as this is what Filter expects
import org.slf4j.LoggerFactory
import play.api.mvc.{Filter, RequestHeader, Result}

import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}
import scala.jdk.CollectionConverters._
import net.logstash.logback.marker.Markers.appendEntries
import net.logstash.logback.marker.LogstashMarker
import play.api.mvc.Results.InternalServerError
import services.AppConfig

class RequestLoggingFilter(override val mat: Materializer)(implicit ec: ExecutionContext) extends Filter {
  val logger = LoggerFactory.getLogger("access")

  override def apply(next: (RequestHeader) => Future[Result])(rh: RequestHeader): Future[Result] = {
    val start = System.currentTimeMillis()
    val result = next(rh)

    result onComplete {
      case Success(response) =>
        val duration = System.currentTimeMillis() - start
        val (structuredMessage, message) = RequestLoggingFilter.buildSuccessMessage(rh, response, duration)
        logger.info(structuredMessage, message)

      case Failure(err) =>
        val duration = System.currentTimeMillis() - start
        val (structuredFailureMessage, failureMessage) = RequestLoggingFilter.buildFailureMessage(rh, duration, err)
        logger.error(structuredFailureMessage, failureMessage)
    }

    result
  }
}

object RequestLoggingFilter {
  def buildSuccessMessage(request: RequestHeader, response: Result, duration: Long): (LogstashMarker, String) = {
    val originIp = request.headers.get("X-Forwarded-For").getOrElse(request.remoteAddress)
    val referer = request.headers.get("Referer").getOrElse("")
    val length = response.header.headers.getOrElse("Content-Length", 0)
    val uri = request.uri

    val marker = appendEntries(Map(
      "originIp" -> originIp,
      "method" -> request.method,
      "uri" -> uri,
      "version" -> request.version,
      "status" -> response.header.status,
      "length" -> length,
      "referer" -> referer,
      "duration" -> s"${duration}ms"
    ).asJava)

    val messageString = s"""$originIp - "${request.method} $uri ${request.version}" ${response.header.status} $length "$referer" ${duration}ms"""

    (marker, messageString)

  }

  def buildFailureMessage(request: RequestHeader, duration: Long, error: Throwable): (LogstashMarker, String) = {
    val originIp = request.headers.get("X-Forwarded-For").getOrElse(request.remoteAddress)
    val referer = request.headers.get("Referer").getOrElse("")

    val uri = request.uri

    val marker = appendEntries(Map(
      "originIp" -> originIp,
      "method" -> request.method,
      "uri" -> uri,
      "version" -> request.version,
      "referer" -> referer,
      "duration" -> s"${duration}ms"
    ).asJava)

    val messageString = s"""$originIp - "${request.method} $uri ${request.version}" ERROR: ${error.toString}  "$referer" ${duration}ms"""
    (marker, messageString)
  }
}

class ReadOnlyFilter(appConfig: AppConfig, override val mat: Materializer) extends Filter {
  override def apply(next: (RequestHeader) => Future[Result])(rh: RequestHeader): Future[Result] = {
    val whitelistPaths = Set("/api/auth/token")
    val disallowedHttpMethods = Set("POST", "DELETE", "PUT")

    if (!whitelistPaths.contains(rh.path) && appConfig.readOnly && disallowedHttpMethods.contains(rh.method)) {
      Future.successful(InternalServerError(s"Application in read only mode"))
    } else {
      next(rh)
    }
  }
}

