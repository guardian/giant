package com.gu.pfi.cli.service

import java.io.ByteArrayInputStream
import java.nio.file.Path

import com.amazonaws.auth.AWSCredentialsProvider
import com.amazonaws.client.builder.AwsClientBuilder.EndpointConfiguration
import com.amazonaws.services.s3.model.{ObjectMetadata, PutObjectRequest, PutObjectResult}
import com.amazonaws.services.s3.transfer.model.UploadResult
import com.amazonaws.services.s3.transfer.{TransferManager, TransferManagerBuilder}
import com.amazonaws.services.s3.{AmazonS3, AmazonS3ClientBuilder}
import com.gu.pfi.cli.IngestCommandOptions
import model.Language
import model.ingestion._
import play.api.libs.json.Json
import utils.Logging

import scala.concurrent.ExecutionContext

trait IngestionS3Client {
  def putData(key: Key, data: Array[Byte], size: Long): PutObjectResult
  def putFileData(key: Key, file: Path, size: Long): UploadResult
  def putMetadata(key: Key, metadata: OnDiskFileContext, ingestion: String, languages: List[Language]): PutObjectResult
}

class DefaultIngestionS3Client(cmd: IngestCommandOptions, credentials: AWSCredentialsProvider)(implicit ec: ExecutionContext) extends IngestionS3Client with Logging {
  val s3: AmazonS3 = (cmd.minioAccessKey.toOption, cmd.minioSecretKey.toOption, cmd.minioEndpoint.toOption) match {
    case (Some(_), Some(_), Some(minioEndpoint)) =>
      // https://docs.minio.io/docs/how-to-use-aws-sdk-for-java-with-minio-server
      AmazonS3ClientBuilder.standard()
        .withEndpointConfiguration(new EndpointConfiguration(minioEndpoint, cmd.region()))
        .withPathStyleAccessEnabled(true)
        .withCredentials(credentials)
        .build()

    case _ =>
      logger.info("Not all minio parameters were supplied, using AWS S3")
      AmazonS3ClientBuilder.standard()
        .withCredentials(credentials)
        .withRegion(cmd.region())
        .build()
  }

  val tm: TransferManager = TransferManagerBuilder.standard()
    .withS3Client(s3)
    .withMultipartUploadThreshold(100L * 1024 * 1024)
    .withMinimumUploadPartSize(100L * 1024 * 1024)
    .build()

  def putData(key: Key, data: Array[Byte], size: Long): PutObjectResult = {
    val metadata = createMetadata(contentType = None, Some(data.length))
    val request = new PutObjectRequest(cmd.ingestionBucket(), dataKey(key), new ByteArrayInputStream(data), metadata)

    s3.putObject(request)
  }

  def putFileData(key: Key, file: Path, size: Long): UploadResult = {
    val metadata = createMetadata(contentType = None, Some(size))
    val request = new PutObjectRequest(cmd.ingestionBucket(), dataKey(key), file.toFile).withMetadata(metadata)

    tm.upload(request).waitForUploadResult()
  }

  def putMetadata(key: Key, metadata: OnDiskFileContext, ingestion: String, languages: List[Language]): PutObjectResult = {
    val ingestMetadata = IngestMetadata(ingestion, metadata.file, languages)
    val bytes = Json.toBytes(Json.toJson(ingestMetadata))

    val requestMetadata = createMetadata(Some("application/json"), Some(bytes.length))
    val request = new PutObjectRequest(cmd.ingestionBucket(), metadataKey(key), new ByteArrayInputStream(bytes), requestMetadata)

    s3.putObject(request)
  }

  private def createMetadata(contentType: Option[String], contentLength: Option[Long] = None): ObjectMetadata = {
    val metadata = new ObjectMetadata()
    contentType.foreach(metadata.setContentType)
    contentLength.foreach(metadata.setContentLength)
    cmd.sseAlgorithm.toOption.foreach(metadata.setSSEAlgorithm)

    metadata
  }
}
