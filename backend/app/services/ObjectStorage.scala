package services

import com.amazonaws.HttpMethod
import com.amazonaws.services.s3.model.{DeleteObjectsRequest, ListObjectsRequest, ObjectListing, S3ObjectSummary}

import java.io.InputStream
import java.nio.file.Path
import model.ObjectMetadata
import org.joda.time.DateTime
import utils.attempt.{Failure, IllegalStateFailure, UnknownFailure}
import utils.aws.{AwsErrors, S3Client}

import java.util.Date
import scala.jdk.CollectionConverters._
import scala.util.control.NonFatal

trait ObjectStorage {
  def create(key: String, path: Path, mimeType: Option[String] = None): Either[Failure, Unit]
  def get(key: String): Either[Failure, InputStream]
  def getSignedUrl(key: String): Either[Failure, String]
  def getUploadSignedUrl(key: String): Either[Failure, String]
  def getMetadata(key: String): Either[Failure, ObjectMetadata]
  def delete(key: String): Either[Failure, Unit]
  def deleteMultiple(key: Set[String]): Either[Failure, Unit]
  def list(prefix: String): Either[Failure, List[String]]
}

class S3ObjectStorage private(client: S3Client, bucket: String) extends ObjectStorage {
  def create(key: String, path: Path, mimeType: Option[String] = None): Either[Failure, Unit] = run {
    client.putLargeObject(bucket, key, contentType = mimeType, path)
    ()
  }

  def get(key: String): Either[Failure, InputStream] = {
    run(client.aws.getObject(bucket, key).getObjectContent)
  }

  def getSignedUrl(key: String): Either[Failure, String] = {

    val thisTimeTomorrow = new DateTime().plusDays(1)

    run(client.aws.generatePresignedUrl(bucket, key,thisTimeTomorrow.toDate).toString)
  }

  def getUploadSignedUrl(key: String): Either[Failure, String] = {

    val thisTimeTomorrow = new DateTime().plusDays(1)

    run(client.aws.generatePresignedUrl(bucket, key, thisTimeTomorrow.toDate, HttpMethod.PUT).toString)
  }

  def getMetadata(key: String): Either[Failure, ObjectMetadata] = run {
    val stats = client.aws.getObjectMetadata(bucket, key)
    ObjectMetadata(stats.getContentLength, stats.getContentType)
  }

  def delete(key: String): Either[Failure, Unit] = {
    run(client.aws.deleteObject(bucket, key))
  }

  def deleteMultiple(keys: Set[String]): Either[Failure, Unit] = {
    val request = new DeleteObjectsRequest(bucket).withKeys(keys.toSeq: _*)
    run(client.aws.deleteObjects(request))
  }

  def list(prefix: String): Either[Failure, List[String]] = {
    val request = new ListObjectsRequest()
      .withBucketName(bucket)
      .withPrefix(prefix)

    run {
      client.aws.listObjects(request)
        .getObjectSummaries
        .asScala
        .toList
        .map(_.getKey)
    }
  }

  private def run[T](fn: => T): Either[Failure, T] = try {
    Right(fn)
  } catch {
    case NonFatal(err) =>
      Left(AwsErrors.exceptionToFailure.lift(err).getOrElse(UnknownFailure(err)))
  }
}

object S3ObjectStorage {
  def apply(client: S3Client, bucket: String): Either[Failure, S3ObjectStorage] = {
    try {
      if (!client.doesBucketExist(bucket)) {
        Left(IllegalStateFailure(s"Bucket $bucket does not exist"))
      } else {
        Right(new S3ObjectStorage(client, bucket))
      }
    } catch {
      case ex: Exception => Left(UnknownFailure(ex))
    }
  }
}