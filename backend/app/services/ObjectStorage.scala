package services

import java.io.InputStream
import java.nio.file.Path

import model.ObjectMetadata
import utils.attempt.{Failure, IllegalStateFailure, UnknownFailure}
import utils.aws.{AwsErrors, S3Client}

import scala.util.control.NonFatal

trait ObjectStorage {
  def create(key: String, path: Path, mimeType: Option[String] = None): Either[Failure, Unit]
  def get(key: String): Either[Failure, InputStream]
  def getMetadata(key: String): Either[Failure, ObjectMetadata]
  def delete(key: String): Either[Failure, Unit]
}

class S3ObjectStorage private(client: S3Client, bucket: String) extends ObjectStorage {
  def create(key: String, path: Path, mimeType: Option[String] = None): Either[Failure, Unit] = run {
    client.putLargeObject(bucket, key, contentType = mimeType, path)
    ()
  }

  def get(key: String): Either[Failure, InputStream] = {
    // --S3: close stream
    run(client.aws.getObject(bucket, key).getObjectContent)
  }

  def getMetadata(key: String): Either[Failure, ObjectMetadata] = run {
    // --S3: close stream
    val stats = client.aws.getObjectMetadata(bucket, key)
    ObjectMetadata(stats.getContentLength, stats.getContentType)
  }

  def delete(key: String): Either[Failure, Unit] = {
    run(client.aws.deleteObject(bucket, key))
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
