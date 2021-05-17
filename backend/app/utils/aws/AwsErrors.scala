package utils.aws

import com.amazonaws.services.s3.model.AmazonS3Exception
import com.amazonaws.{AmazonServiceException, SdkClientException}
import utils.attempt.{AwsSdkFailure, Failure, NotFoundFailure}

object AwsErrors {
  val exceptionToFailure: PartialFunction[Throwable, Failure] = {
    case err: AmazonS3Exception if err.getStatusCode == 404 =>
      NotFoundFailure(err.toString)
    case ase: AmazonServiceException =>
      AwsSdkFailure(ase) // TODO/SAH: Use a more specific failure that captures the error codes etc
    case sce: SdkClientException =>
      AwsSdkFailure(sce)
  }
}
