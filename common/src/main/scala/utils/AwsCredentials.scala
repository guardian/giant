package utils

import com.amazonaws.auth.profile.{ProfileCredentialsProvider => ProfileCredentialsProviderV1}
import com.amazonaws.auth.{AWSCredentialsProviderChain => AWSCredentialsProviderChainV1}
import com.amazonaws.auth.{AWSStaticCredentialsProvider => AWSStaticCredentialsProviderV1}
import com.amazonaws.auth.{BasicAWSCredentials => BasicAWSCredentialsV1}
import com.amazonaws.auth.{AWSCredentialsProvider => AWSCredentialsProviderV1}
import com.amazonaws.auth.{InstanceProfileCredentialsProvider => InstanceProfileCredentialsProviderV1}
import software.amazon.awssdk.auth.credentials.{AwsBasicCredentials, AwsCredentialsProvider, AwsCredentialsProviderChain, InstanceProfileCredentialsProvider, ProfileCredentialsProvider, StaticCredentialsProvider}
import scala.jdk.CollectionConverters._

object AwsCredentials {
  def apply(accessKey: Option[String] = None, secretKey: Option[String] = None, profile: Option[String] = None): AWSCredentialsProviderV1 = {
    // You must never break the chain...
    // Static credentials should come first in order to override any federated credentials a dev may have on their machine
    new AWSCredentialsProviderChainV1(minioCredentials(accessKey, secretKey) ++ awsCredentials(profile) : _*)
  }

  def credentialsV2(accessKey: Option[String] = None, secretKey: Option[String] = None, profile: Option[String] = None): AwsCredentialsProvider = {
    val credentialsProviders = minioCredentialsV2(accessKey, secretKey) ++ awsCredentialsV2(profile)
    AwsCredentialsProviderChain.builder()
      .credentialsProviders(credentialsProviders.asJava)
      .build()
  }

  private def awsCredentials(profile: Option[String]): List[AWSCredentialsProviderV1] = {
    List(
      new ProfileCredentialsProviderV1(profile.getOrElse("investigations")),
      InstanceProfileCredentialsProviderV1.getInstance()
    )
  }

  private def awsCredentialsV2(profile: Option[String]): List[AwsCredentialsProvider] = {
    List(
      ProfileCredentialsProvider.create(profile.getOrElse("investigations")),
      InstanceProfileCredentialsProvider.create()
    )
  }

  private def minioCredentials(accessKey: Option[String], secretKey: Option[String]): List[AWSCredentialsProviderV1] = {
    (accessKey, secretKey) match {
      case (Some(ak), Some(sk)) =>
        List(new AWSStaticCredentialsProviderV1(new BasicAWSCredentialsV1(ak, sk)))
      case _ =>
        List.empty
    }
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
