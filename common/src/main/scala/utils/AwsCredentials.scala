package utils

import software.amazon.awssdk.auth.credentials.{AwsBasicCredentials, AwsCredentialsProvider, AwsCredentialsProviderChain, InstanceProfileCredentialsProvider, ProfileCredentialsProvider, StaticCredentialsProvider}
import scala.jdk.CollectionConverters._

object AwsCredentials {
  def credentialsV2(accessKey: Option[String] = None, secretKey: Option[String] = None, profile: Option[String] = None): AwsCredentialsProvider = {
    val credentialsProviders = minioCredentialsV2(accessKey, secretKey) ++ awsCredentialsV2(profile)
    AwsCredentialsProviderChain.builder()
      .credentialsProviders(credentialsProviders.asJava)
      .build()
  }

  private def awsCredentialsV2(profile: Option[String]): List[AwsCredentialsProvider] = {
    List(
      ProfileCredentialsProvider.create(profile.getOrElse("investigations")),
      InstanceProfileCredentialsProvider.create()
    )
  }

  private def minioCredentialsV2(accessKey: Option[String], secretKey: Option[String]): List[AwsCredentialsProvider] = {
    (accessKey, secretKey) match {
      case (Some(ak), Some(sk)) =>
        List(StaticCredentialsProvider.create(AwsBasicCredentials.create(ak, sk)))
      case _ =>
        List.empty
    }
  }
}
