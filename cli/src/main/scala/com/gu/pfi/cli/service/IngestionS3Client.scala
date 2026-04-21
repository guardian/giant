package com.gu.pfi.cli.service

import java.nio.file.Path
import software.amazon.awssdk.services.s3.model.{PutObjectRequest, PutObjectResponse}
import software.amazon.awssdk.auth.credentials.{AwsCredentialsProvider, DefaultCredentialsProvider}
import com.gu.pfi.cli.IngestCommandOptions
import model.Language
import model.ingestion._
import play.api.libs.json.Json
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.{S3AsyncClient, S3Client}
import software.amazon.awssdk.transfer.s3.S3TransferManager
import software.amazon.awssdk.transfer.s3.model.{CompletedUpload, UploadRequest}
import utils.Logging

import java.net.URI
import scala.concurrent.{Await, ExecutionContext}
import scala.jdk.FutureConverters.CompletionStageOps

trait IngestionS3Client {
  def putData(key: Key, data: Array[Byte], size: Long): PutObjectResponse
  def putFileData(key: Key, file: Path, size: Long): CompletedUpload
  def putMetadata(key: Key, metadata: OnDiskFileContext, ingestion: String, languages: List[Language]): PutObjectResponse
}

class DefaultIngestionS3Client(cmd: IngestCommandOptions, credentials: AwsCredentialsProvider)(implicit ec: ExecutionContext) extends IngestionS3Client with Logging {
  val s3Async: S3AsyncClient = (cmd.minioAccessKey.toOption, cmd.minioSecretKey.toOption, cmd.minioEndpoint.toOption) match {
    case (Some(_), Some(_), Some(minioEndpoint)) =>
      // https://docs.minio.io/docs/how-to-use-aws-sdk-for-java-with-minio-server
      S3AsyncClient.crtBuilder()
        .endpointOverride(new URI(minioEndpoint))
        .credentialsProvider(credentials)
        .forcePathStyle(true)
        .minimumPartSizeInBytes(100L * 1024 * 1024)
        .region(Region.of(cmd.region()))
        .build()

    case _ =>
      logger.info("Not all minio parameters were supplied, using AWS S3")
      S3AsyncClient.crtBuilder()
        .credentialsProvider(credentials)
        .region(Region.of(cmd.region()))
        .build()
  }

  val s3: S3Client  = (cmd.minioAccessKey.toOption, cmd.minioSecretKey.toOption, cmd.minioEndpoint.toOption) match {
    case (Some(_), Some(_), Some(minioEndpoint)) =>
      // https://docs.minio.io/docs/how-to-use-aws-sdk-for-java-with-minio-server
      S3Client.builder()
        .endpointOverride(new URI(minioEndpoint))
        .credentialsProvider(credentials)
        .forcePathStyle(true)
        .region(Region.of(cmd.region()))
        .build()

    case _ =>
      logger.info("Not all minio parameters were supplied, using AWS S3")
      S3Client.builder()
        .credentialsProvider(credentials)
        .region(Region.of(cmd.region()))
        .build()
  }

  val tm: S3TransferManager = S3TransferManager.builder()
    .s3Client(s3Async)
    .build()

  def putData(key: Key, data: Array[Byte], size: Long): PutObjectResponse = {
    val request = PutObjectRequest.builder
      .bucket(cmd.ingestionBucket())
      .key(dataKey(key))
      .contentLength(size)
      .build()

    s3.putObject(request, RequestBody.fromBytes(data))
  }

  def putFileData(key: Key, file: Path, size: Long): CompletedUpload = {
//    val metadata = createMetadata(contentType = None, Some(size))
//    val request = new PutObjectRequest(cmd.ingestionBucket(), dataKey(key), file.toFile).withMetadata(metadata)

    val request = PutObjectRequest.builder
      .bucket(cmd.ingestionBucket())
      .key(dataKey(key))
      .contentLength(size)
      .build()

    val uploadRequest = UploadRequest.builder
      .putObjectRequest(request)
      .build()

    val result = tm.upload(uploadRequest).completionFuture()
    Await.result(result.asScala, scala.concurrent.duration.Duration.Inf)
  }

  def putMetadata(key: Key, metadata: OnDiskFileContext, ingestion: String, languages: List[Language]): PutObjectResponse = {
    val ingestMetadata = IngestMetadata(ingestion, metadata.file, languages)
    val bytes = Json.toBytes(Json.toJson(ingestMetadata))

    val request = PutObjectRequest.builder
      .bucket(cmd.ingestionBucket())
      .key(metadataKey(key))
      .contentLength(bytes.length)
      .contentType("application/json")
      .build()

    s3.putObject(request, RequestBody.fromBytes(bytes))

  }
}
