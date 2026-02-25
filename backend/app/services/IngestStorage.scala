package services

import java.io.InputStream
import java.util.UUID
import cats.syntax.either._
import software.amazon.awssdk.services.s3.model.{CopyObjectRequest, DeleteObjectRequest, DeleteObjectResponse, GetObjectRequest, ListObjectsV2Request, S3Object}
import model.ingestion._
import play.api.libs.json.{JsError, JsSuccess, Json}
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import utils.Logging
import utils.attempt.{Failure, IllegalStateFailure, JsonParseFailure, UnknownFailure}
import utils.aws.S3Client

import scala.jdk.CollectionConverters._
import scala.util.Try
import java.time.Duration
import scala.util.control.NonFatal

trait IngestStorage {
  def list: Either[Failure, Iterable[Key]]
  def getData(key: Key): Either[Failure, InputStream]
  def getMetadata(key: Key): Either[Failure, FileContext]
  def delete(key: Key): Either[Failure, DeleteObjectResponse]
  def sendToDeadLetterBucket(key: Key): Either[Failure, DeleteObjectResponse]
  def retryDeadLetters(): Either[Failure, Unit]
  def getUploadSignedUrl(key: Key): Either[Failure, String]
}

class S3IngestStorage private(client: S3Client, presigner: S3Presigner, ingestBucket: String, deadLetterBucket: String) extends IngestStorage with Logging {
  private def parseKey(item: S3Object): (Long, UUID) = {
    val components = item.key().stripPrefix(dataPrefix).stripSuffix(".data").split('_')
    val timestamp = components(0).toLong
    val uuid = UUID.fromString(components(1))

    timestamp -> uuid
  }

  def getUploadSignedUrl(key: Key): Either[Failure, String] = {
    val getObjectRequest = GetObjectRequest.builder()
      .bucket(ingestBucket)
      .key(dataKey(key))
      .build()

    val presignRequest = GetObjectPresignRequest.builder()
      .signatureDuration(Duration.ofHours(24))
      .getObjectRequest(getObjectRequest)
      .build()

    Either.catchNonFatal(presigner.presignGetObject(presignRequest).url().toString).leftMap(UnknownFailure.apply)
  }


  override def list = {
    Either.catchNonFatal {
      val listObjectsV2Request = ListObjectsV2Request.builder()
        .bucket(ingestBucket)
        .prefix(dataPrefix)
        .build()

      val result = client.s3.listObjectsV2(listObjectsV2Request)
      val objs = result.contents().asScala
      objs.map(parseKey)
    }.leftMap(UnknownFailure.apply)
  }

  override def getData(key: Key): Either[Failure, InputStream] = {
    val request = GetObjectRequest.builder()
      .bucket(ingestBucket)
      .key(dataKey(key))
      .build()
    Either.catchNonFatal(client.s3.getObject(request)).leftMap(UnknownFailure.apply)
  }

  override def getMetadata(key: Key): Either[Failure, FileContext] = {
    val request = GetObjectRequest.builder()
      .bucket(ingestBucket)
      .key(dataKey(key))
      .build()

    Either.catchNonFatal(client.s3.getObject(request)).leftMap(UnknownFailure.apply).flatMap { stream =>
      // turn stream back into the original object

      try {
        val json = Json.parse(stream)

        Json.fromJson[IngestMetadata](json) match {
          case JsSuccess(metadata, _) => FileContext.fromIngestMetadata(metadata)
          case JsError(error) => Left(JsonParseFailure(error))
        }
      } finally {
        stream.close()
      }
    }
  }

  override def delete(key: (Long, UUID)): Either[UnknownFailure, DeleteObjectResponse] = {
    Either.catchNonFatal {
      val dataKeyDeleteRequest = DeleteObjectRequest.builder()
        .bucket(ingestBucket)
        .key(dataKey(key))
        .build()
      client.s3.deleteObject(dataKeyDeleteRequest)

      val metadataKeyDeleteRequest = DeleteObjectRequest.builder()
        .bucket(ingestBucket)
        .key(dataKey(key))
        .build()

      client.s3.deleteObject(dataKeyDeleteRequest)
      client.s3.deleteObject(metadataKeyDeleteRequest)
    }.leftMap(UnknownFailure.apply)
  }

  override def sendToDeadLetterBucket(key: Key): Either[Failure, DeleteObjectResponse] = {
    Either.catchNonFatal {

      val dataKeyCopyRequest = CopyObjectRequest.builder()
        .sourceBucket(ingestBucket)
        .sourceKey(dataKey(key))
        .destinationBucket(deadLetterBucket)
        .destinationKey(dataKey(key))
        .build()

      val metaDataKeyCopyRequest = CopyObjectRequest.builder()
        .sourceBucket(ingestBucket)
        .sourceKey(metadataKey(key))
        .destinationBucket(deadLetterBucket)
        .destinationKey(metadataKey(key))
        .build()

      client.s3.copyObject(dataKeyCopyRequest)
      client.s3.copyObject(metaDataKeyCopyRequest)
    } match {
      // if copy succeeded, delete the files from the ingest bucket
      case Right(_) => delete(key)
      case Left(failure) => Left(UnknownFailure(failure))
    }
  }

  override def retryDeadLetters(): Either[UnknownFailure, Unit] = {
    Either.catchNonFatal {

      val listObjectsRequest = ListObjectsV2Request.builder()
        .bucket(deadLetterBucket)
        .build()

      val response = client.s3.listObjectsV2(listObjectsRequest)
      if (!response.isTruncated) {
        logger.info(s"Sending ${response.contents().size()} files from dead letter bucket to ingest bucket.")
        val (meta, data) = response.contents().asScala.toList.map(_.key()).partition(k => k.startsWith("meta"))
        // ingestion starts once a 'data' file is available, so copy meta files first
        val keysWithMetaFirst = meta.concat(data)
        keysWithMetaFirst.foreach{ key =>

          val copyRequest = CopyObjectRequest.builder()
            .sourceBucket(deadLetterBucket)
            .sourceKey(key)
            .destinationBucket(deadLetterBucket)
            .destinationKey(key)
            .build()
          Try(client.s3.copyObject(copyRequest))
            // on success, clean up the file from the dead letter bucket
            .map(_ => client.s3.deleteObject(DeleteObjectRequest.builder()
              .bucket(deadLetterBucket)
              .key(key)
              .build()))
        }
      } else {
        val msg = "Too many dead letter files to resync via API. Try using aws cli e.g aws s3 sync s3://deadletterbucket s3://ingestbucket"
        logger.error(msg)
        throw new Error(msg)
      }
    }.leftMap(UnknownFailure.apply)
  }
}


object S3IngestStorage {
  def apply(client: S3Client, s3Presigner: S3Presigner, ingestBucketName: String, deadLetterBucketName: String): Either[Failure, S3IngestStorage] = {
    try {
      if (!client.doesBucketExist(ingestBucketName)) {
        Left(IllegalStateFailure(s"Bucket $ingestBucketName does not exist"))
      } else if (!client.doesBucketExist(deadLetterBucketName)) {
        Left(IllegalStateFailure(s"Bucket $deadLetterBucketName does not exist"))
      }else {
        Right(new S3IngestStorage(client, s3Presigner, ingestBucketName, deadLetterBucketName))
      }
    } catch {
      case ex: Exception => Left(UnknownFailure(ex))
    }
  }
}
