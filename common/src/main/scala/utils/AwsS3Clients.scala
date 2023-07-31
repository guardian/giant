package utils

import com.amazonaws.auth.AWSCredentialsProvider
import com.amazonaws.client.builder.AwsClientBuilder.EndpointConfiguration
import com.amazonaws.services.s3.{AmazonS3, AmazonS3ClientBuilder}
import com.amazonaws.services.s3.transfer.{TransferManager, TransferManagerBuilder}

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
      println("MINIO")
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

  def pandaS3Client(credentials: AWSCredentialsProvider, region: String): AmazonS3 = {
    AmazonS3ClientBuilder.standard()
      .withCredentials(credentials)
      .withRegion(region)
      .build()
  }
}
