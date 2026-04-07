package utils

import software.amazon.awssdk.transfer.s3.S3TransferManager
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3AsyncClient

import java.net.URI

object AwsS3Clients {
  def apply(credentials: AwsCredentialsProvider, region: Region, endpoint: Option[String]): (S3Client, S3TransferManager) = {
    val amazonS3 = buildS3ClientV2(credentials, region, endpoint)
    val amazonS3Async = buildS3ClientAsyncV2(credentials, region, endpoint)

    val transferManagerBuilder = S3TransferManager.builder()
      .s3Client(amazonS3Async)

    val transferManager = transferManagerBuilder.build()

    amazonS3 -> transferManager
  }

  private def buildS3ClientV2(credentials: AwsCredentialsProvider, region: Region, endpoint: Option[String]): S3Client = endpoint match {
    case Some(minioEndpoint) =>
      // https://docs.minio.io/docs/how-to-use-aws-sdk-for-java-with-minio-server
      S3Client.builder()
        .endpointOverride(new URI(minioEndpoint))
        .credentialsProvider(credentials)
        .forcePathStyle(true)
        .region(region)
        .build()

    case _ =>
      S3Client.builder()
        .credentialsProvider(credentials)
        .region(region)
        .build()
  }

  private def buildS3ClientAsyncV2(credentials: AwsCredentialsProvider, region: Region, endpoint: Option[String]): S3AsyncClient = endpoint match {
    case Some(minioEndpoint) =>
      // https://docs.minio.io/docs/how-to-use-aws-sdk-for-java-with-minio-server
      S3AsyncClient.builder()
        .endpointOverride(new URI(minioEndpoint))
        .credentialsProvider(credentials)
        .forcePathStyle(true)
        .region(region)
        .build()

    case _ =>
      S3AsyncClient.builder()
        .credentialsProvider(credentials)
        .region(region)
        .build()
  }

  def pandaS3Client(credentials: AwsCredentialsProvider, region: String): S3Client= {
    S3Client.builder()
      .credentialsProvider(credentials)
      .region(Region.of(region))
      .build()
  }
}
