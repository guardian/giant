package utils.attempt

import java.io.{PrintWriter, StringWriter}

import cats.kernel.Semigroup
import play.api.libs.json._

import scala.collection.Seq

sealed trait Failure {
  def msg: String
  def cause: Option[Throwable] = None

  def toThrowable: Throwable = cause.getOrElse(new RuntimeException(msg))
}

object Failure {
  implicit val combiner = new Semigroup[Failure] {
    override def combine(xFailure: Failure, yFailure: Failure): Failure = {
      (xFailure, yFailure) match {
        case (MultipleFailures(xs), MultipleFailures(ys)) => MultipleFailures(xs ::: ys)
        case (MultipleFailures(xs), y) => MultipleFailures(xs :+ y)
        case (x, MultipleFailures(ys)) => MultipleFailures(x :: ys)
        case (x, y) => MultipleFailures(List(x, y))
      }
    }
  }
}

/**
  * If you ever accumulate failures then you can return one of these instead
  * @param failures
  */
case class MultipleFailures(failures: List[Failure]) extends Failure {
  override def msg = {
    val failureMessages = failures.map(_.msg)
    s"Multiple failures: \n${failureMessages.mkString("\n")}"
  }
}

/**
  * This type of failure has a throwable which could potentially be logged
  */
sealed trait FailureWithThrowable extends Failure {
  def throwable: Throwable
  override def cause = Some(throwable)

  // provide a default mechanism for showing the exception to a user
  override def msg = {
    val stringWriter = new StringWriter()
    val writer = new PrintWriter(stringWriter)
    throwable.printStackTrace(writer)

    stringWriter.toString
  }
}

/**
  * Authorization failures should never be revealed via APIs or to users
  */
sealed trait HiddenFailure extends Failure {
  def actualMessage: String
}

case class NotFoundFailure(msg: String) extends Failure
case class IllegalStateFailure(msg: String) extends Failure
case class ClientFailure(msg: String) extends Failure
case class UnsupportedOperationFailure(msg: String) extends Failure
case class TransactionFailure(msg: String) extends Failure
case class AlreadySetupFailure(msg: String) extends Failure
case class JsonParseFailure(error: Seq[(JsPath, Seq[JsonValidationError])]) extends Failure {
  override def msg = error.toString
}
case class ElasticSearchQueryFailure(
  throwable: Throwable,
  responseCode: Int,
  responseBody: Option[String]
) extends FailureWithThrowable

case class UnknownFailure(throwable: Throwable) extends FailureWithThrowable
case class Neo4JFailure(throwable: Throwable) extends FailureWithThrowable
case class Neo4JTransientFailure(throwable: Throwable) extends FailureWithThrowable
case class Neo4JValueFailure(msg: String) extends Failure
case class AwsSdkFailure(throwable: Throwable) extends FailureWithThrowable

case class PostgresReadFailure(throwable: Throwable, message: String) extends FailureWithThrowable {
  final override def msg = s"Postgres query failed. Query: ${message}"
}
case class PostgresWriteFailure(throwable: Throwable) extends FailureWithThrowable {
  final override def msg = "Failed to write to postgres"
}

case class FfMpegFailure(throwable: Throwable, message: String) extends FailureWithThrowable {
  final override def msg = message  + " - " + super.msg
}

case class UserDoesNotExistFailure(username: String) extends HiddenFailure {
  final override def actualMessage = s"$username does not exist"
  final override def msg = "Login failure"
}

case class LoginFailure(actualMessage: String) extends HiddenFailure {
  final override def msg = "Login failure"
}

case class AuthenticationFailure(actualMessage: String, override val cause: Option[Throwable] = None, reportAsFailure: Boolean)
  extends HiddenFailure {
  final override def msg = "Authentication failure"
}

case class MissingPermissionFailure(msg: String) extends Failure

case class SecondFactorRequired(msg: String) extends Failure

case class PanDomainCookieInvalid(override val msg: String, reportAsFailure: Boolean) extends Failure

case class MisconfiguredAccount(msg: String) extends Failure

case class OcrTimeout(msg: String) extends Failure

case object PreviewNotSupportedFailure extends Failure {
  final override def msg = "Preview not supported for this file type"
}

case object SubprocessInterruptedFailure extends Failure {
  final override def msg = "Subprocess terminated externally"
}

case class ContentTooLongFailure(msg: String) extends Failure

case class DeleteFailure(msg: String) extends Failure

case class DeleteNotAllowed(msg: String) extends Failure