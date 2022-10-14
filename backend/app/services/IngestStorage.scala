package services

import java.io.InputStream
import java.util.UUID

import cats.syntax.either._
import com.amazonaws.services.s3.model.S3ObjectSummary
import model.{Languages, Uri}
import model.ingestion._
import play.api.libs.json.{JsError, JsSuccess, Json}
import utils.Logging
import utils.attempt.{Failure, IllegalStateFailure, JsonParseFailure, UnknownFailure}
import utils.aws.S3Client

import scala.jdk.CollectionConverters._
import scala.util.control.NonFatal

trait IngestStorage {
  def list: Either[Failure, Iterable[Key]]
  def getData(key: Key): Either[Failure, InputStream]
  def getMetadata(key: Key): Either[Failure, FileContext]
  def delete(key: Key): Either[Failure, Unit]
}

class S3IngestStorage private(client: S3Client, bucket: String) extends IngestStorage with Logging {
  private def parseKey(item: S3ObjectSummary): (Long, UUID) = {
    val components = item.getKey.stripPrefix(dataPrefix).stripSuffix(".data").split('_')
    val timestamp = components(0).toLong
    val uuid = UUID.fromString(components(1))

    timestamp -> uuid
  }

  override def list = {
    Either.catchNonFatal {
      val result = client.aws.listObjects(bucket, dataPrefix)
      val objs = result.getObjectSummaries.asScala
      objs.map(parseKey)
    }.leftMap(UnknownFailure.apply)
  }

  override def getData(key: Key): Either[Failure, InputStream] = {
    Either.catchNonFatal(client.aws.getObject(bucket, dataKey(key)).getObjectContent).leftMap(UnknownFailure.apply)
  }

  override def getMetadata(key: Key): Either[Failure, FileContext] = {
    Either.catchNonFatal(client.aws.getObject(bucket, metadataKey(key))).leftMap(UnknownFailure.apply).flatMap { s3Object =>
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
      client.aws.deleteObject(bucket, dataKey(key))
      client.aws.deleteObject(bucket, metadataKey(key))
    }.leftMap(UnknownFailure.apply)
  }
}

object S3IngestStorage {
  def apply(client: S3Client, bucketName: String): Either[Failure, S3IngestStorage] = {
    try {
      if (!client.doesBucketExist(bucketName)) {
        Left(IllegalStateFailure(s"Bucket $bucketName does not exist"))
      } else {
        Right(new S3IngestStorage(client, bucketName))
      }
    } catch {
      case ex: Exception => Left(UnknownFailure(ex))
    }
  }
}
