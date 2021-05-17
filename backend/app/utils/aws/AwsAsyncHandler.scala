package utils.aws

import com.amazonaws.AmazonWebServiceRequest
import com.amazonaws.handlers.AsyncHandler
import utils.Logging
import utils.attempt.{Attempt, Failure, UnknownFailure}

import scala.concurrent.{ExecutionContext, Promise}
import scala.util.control.NonFatal

class AwsAsyncPromiseHandler[R <: AmazonWebServiceRequest, T](promise: Promise[Either[Failure, T]])
  extends AsyncHandler[R, T] with Logging {
  def onError(e: Exception) = {
    e match {
      case NonFatal(t) =>
        logger.warn("Failed to execute AWS SDK operation", t)
        val failure = AwsErrors.exceptionToFailure.applyOrElse(t, UnknownFailure(_))
        promise success Left(failure)
      case fatal =>
        logger.error("Failed to execute AWS SDK operation", fatal)
        promise failure fatal
    }
  }
  def onSuccess(r: R, t: T) = {
    promise success Right(t)
  }
}

object AwsAsyncHandler {
  def awsToScala[R <: AmazonWebServiceRequest, T](sdkMethod: (R, AsyncHandler[R, T]) => java.util.concurrent.Future[T])
                                                 (req: R)
                                                 (implicit ec: ExecutionContext): Attempt[T] = {
    val p = Promise[Either[Failure, T]]
    sdkMethod(req, new AwsAsyncPromiseHandler(p))
    Attempt(p.future)
  }
}