package services

import java.io.InputStream
import java.util.UUID
import cats.syntax.either._
import com.amazonaws.HttpMethod
import com.amazonaws.services.s3.model.S3ObjectSummary
import model.{Languages, Uri}
import model.ingestion._
import org.joda.time.DateTime
import play.api.libs.json.{JsError, JsSuccess, Json}
import utils.Logging
import utils.attempt.{Failure, IllegalStateFailure, JsonParseFailure, UnknownFailure}
import utils.aws.S3Client

import scala.jdk.CollectionConverters._
import scala.util.Try
import scala.util.control.NonFatal

trait IngestStorage {
  def list: Either[Failure, Iterable[Key]]
  def getData(key: Key): Either[Failure, InputStream]
  def getMetadata(key: Key): Either[Failure, FileContext]
  def delete(key: Key): Either[Failure, Unit]
  def sendToDeadLetterBucket(key: Key): Either[Failure, Unit]
  def retryDeadLetters(): Either[Failure, Unit]
}

class S3IngestStorage private(client: S3Client, ingestBucket: String, deadLetterBucket: String) extends IngestStorage with Logging {
  private def parseKey(item: S3ObjectSummary): (Long, UUID) = {
    val components = item.getKey.stripPrefix(dataPrefix).stripSuffix(".data").split('_')
    val timestamp = components(0).toLong
    val uuid = UUID.fromString(components(1))

    timestamp -> uuid
  }

  def getUploadSignedUrl(key: String): Either[Failure, String] = {

    val thisTimeTomorrow = new DateTime().plusDays(1)

    Either.catchNonFatal(client.aws.generatePresignedUrl(ingestBucket, key, thisTimeTomorrow.toDate, HttpMethod.PUT).toString).leftMap(UnknownFailure.apply)
  }

  override def list = {
    Either.catchNonFatal {
      val result = client.aws.listObjects(ingestBucket, dataPrefix)
      val objs = result.getObjectSummaries.asScala
      objs.map(parseKey)
    }.leftMap(UnknownFailure.apply)
  }

  override def getData(key: Key): Either[Failure, InputStream] = {
    Either.catchNonFatal(client.aws.getObject(ingestBucket, dataKey(key)).getObjectContent).leftMap(UnknownFailure.apply)
  }

  override def getMetadata(key: Key): Either[Failure, FileContext] = {
    Either.catchNonFatal(client.aws.getObject(ingestBucket, metadataKey(key))).leftMap(UnknownFailure.apply).flatMap { s3Object =>
      // turn stream back into the original object
      val stream = s3Object.getObjectContent

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

  override def delete(key: (Long, UUID)) = {
    Either.catchNonFatal{
      client.aws.deleteObject(ingestBucket, dataKey(key))
      client.aws.deleteObject(ingestBucket, metadataKey(key))
    }.leftMap(UnknownFailure.apply)
  }

  override def sendToDeadLetterBucket(key: Key): Either[Failure, Unit] = {
    Either.catchNonFatal {
      client.aws.copyObject(ingestBucket, dataKey(key), deadLetterBucket, dataKey(key))
      client.aws.copyObject(ingestBucket, metadataKey(key), deadLetterBucket, metadataKey(key))
    } match {
      // if copy succeeded, delete the files from the ingest bucket
      case Right(_) => delete(key)
      case Left(failure) => Left(UnknownFailure(failure))
    }
  }

  override def retryDeadLetters(): Either[UnknownFailure, Unit] = {
    Either.catchNonFatal {
      val result = client.aws.listObjects(deadLetterBucket)
      if (!result.isTruncated) {
        logger.info(s"Sending ${result.getObjectSummaries.size()} files from dead letter bucket to ingest bucket.")
        val (meta, data) = result.getObjectSummaries.asScala.toList.map(_.getKey).partition(k => k.startsWith("meta"))
        // ingestion starts once a 'data' file is available, so copy meta files first
        val keysWithMetaFirst = meta.concat(data)
        keysWithMetaFirst.foreach{ key =>
          Try(client.aws.copyObject(deadLetterBucket, key, ingestBucket, key))
            // on success, clean up the file from the dead letter bucket
            .map(_ => client.aws.deleteObject(deadLetterBucket, key))
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
  def apply(client: S3Client, ingestBucketName: String, deadLetterBucketName: String): Either[Failure, S3IngestStorage] = {
    try {
      if (!client.doesBucketExist(ingestBucketName)) {
        Left(IllegalStateFailure(s"Bucket $ingestBucketName does not exist"))
      } else if (!client.doesBucketExist(deadLetterBucketName)) {
        Left(IllegalStateFailure(s"Bucket $deadLetterBucketName does not exist"))
      }else {
        Right(new S3IngestStorage(client, ingestBucketName, deadLetterBucketName))
      }
    } catch {
      case ex: Exception => Left(UnknownFailure(ex))
    }
  }
}
