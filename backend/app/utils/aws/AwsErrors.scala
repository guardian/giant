package utils.aws

import software.amazon.awssdk.services.s3.model.S3Exception
import software.amazon.awssdk.core.exception.{SdkClientException, SdkServiceException}
import utils.attempt.{AwsSdkFailure, Failure, NotFoundFailure}

object AwsErrors {
  val exceptionToFailure: PartialFunction[Throwable, Failure] = {
    case err: S3Exception if err.statusCode() == 404 =>
      NotFoundFailure(err.toString)
    case ase: SdkServiceException =>
      AwsSdkFailure(ase) // TODO/SAH: Use a more specific failure that captures the error codes etc
    case sce: SdkClientException =>
      AwsSdkFailure(sce)
  }
}
