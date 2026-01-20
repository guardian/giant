package utils

import com.amazonaws.auth.AWSCredentialsProvider
import com.amazonaws.client.builder.AwsClientBuilder.EndpointConfiguration
import com.amazonaws.services.s3.{AmazonS3, AmazonS3ClientBuilder}
import com.amazonaws.services.s3.transfer.{TransferManager, TransferManagerBuilder}
import software.amazon.awssdk.auth.credentials.{AwsCredentialsProvider => AwsCredentialsProviderV2}
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.{S3Client => S3ClientV2}

object AwsS3Clients {
  def apply(credentials: AWSCredentialsProvider, region: String, endpoint: Option[String]): (AmazonS3, TransferManager) = {
    val amazonS3 = buildS3Client(credentials, region, endpoint)

    val transferManagerBuilder = TransferManagerBuilder.standard()
      .withS3Client(amazonS3)
      .withMultipartUploadThreshold(100L * 1024 * 1024)
      .withMinimumUploadPartSize(100L * 1024 * 1024)

    val transferManager = transferManagerBuilder.build()

    amazonS3 -> transferManager
  }

  private def buildS3Client(credentials: AWSCredentialsProvider, region: String, endpoint: Option[String]): AmazonS3 = endpoint match {
    case Some(minioEndpoint) =>
      // https://docs.minio.io/docs/how-to-use-aws-sdk-for-java-with-minio-server
      AmazonS3ClientBuilder.standard()
        .withEndpointConfiguration(new EndpointConfiguration(minioEndpoint, region))
        .withPathStyleAccessEnabled(true)
        .withCredentials(credentials)
        .build()

    case _ =>
      AmazonS3ClientBuilder.standard()
        .withCredentials(credentials)
        .withRegion(region)
        .build()
  }


  def pandaS3Client(credentials: AwsCredentialsProviderV2, region: String): S3ClientV2 = {
    S3ClientV2.builder()
      .credentialsProvider(credentials)
      .region(Region.of(region))
      .build()
  }
}
