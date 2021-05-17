package utils

import com.amazonaws.auth.profile.ProfileCredentialsProvider
import com.amazonaws.auth._

object AwsCredentials {
  def apply(accessKey: Option[String] = None, secretKey: Option[String] = None, profile: Option[String] = None): AWSCredentialsProvider = {
    // You must never break the chain...
    // Static credentials should come first in order to override any federated credentials a dev may have on their machine
    new AWSCredentialsProviderChain(minioCredentials(accessKey, secretKey) ++ awsCredentials(profile) : _*)
  }

  private def awsCredentials(profile: Option[String]): List[AWSCredentialsProvider] = {
    List(
      new ProfileCredentialsProvider(profile.getOrElse("investigations")),
      InstanceProfileCredentialsProvider.getInstance()
    )
  }

  private def minioCredentials(accessKey: Option[String], secretKey: Option[String]): List[AWSCredentialsProvider] = {
    (accessKey, secretKey) match {
      case (Some(ak), Some(sk)) =>
        List(new AWSStaticCredentialsProvider(new BasicAWSCredentials(ak, sk)))

      case _ =>
        List.empty
    }
  }
}
