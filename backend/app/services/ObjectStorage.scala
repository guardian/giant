package services



import java.io.{ByteArrayInputStream, InputStream}
import java.nio.file.Path
import model.ObjectMetadata
import software.amazon.awssdk.services.s3.model.{Delete, DeleteObjectRequest, DeleteObjectsRequest, GetObjectRequest, HeadObjectRequest, ListObjectsV2Request, ListObjectsV2Response, ObjectIdentifier, PutObjectRequest}
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.{GetObjectPresignRequest, PutObjectPresignRequest}
import utils.attempt.{Failure, IllegalStateFailure, UnknownFailure}
import utils.aws.{AwsErrors, S3Client}

import java.nio.charset.StandardCharsets
import scala.jdk.CollectionConverters._
import scala.util.control.NonFatal
import java.time.Duration
import java.util.zip.GZIPInputStream
import scala.util.Using


trait ObjectStorage {
  def create(key: String, path: Path, mimeType: Option[String] = None): Either[Failure, Unit]
  def putText(key: String, text: String, mimeType: Option[String]): Either[Failure, Unit]
  def get(key: String): Either[Failure, InputStream]
  def getSignedUrl(key: String): Either[Failure, String]
  def getGzippedText(key: String): Either[Failure, String]
  def getUploadSignedUrl(key: String): Either[Failure, String]
  def getMetadata(key: String): Either[Failure, ObjectMetadata]
  def delete(key: String): Either[Failure, Unit]
  def deleteMultiple(key: Set[String]): Either[Failure, Unit]
  def list(prefix: String): Either[Failure, List[String]]
}

class S3ObjectStorage private(client: S3Client, presigner: S3Presigner,  bucket: String) extends ObjectStorage {
  def create(key: String, path: Path, mimeType: Option[String] = None): Either[Failure, Unit] = run {
    client.putLargeObject(bucket, key, contentType = mimeType, path)

    ()
  }

  def putText(key: String, text: String, mimeType: Option[String]): Either[Failure, Unit] = run {
    client.putObjectSync(bucket, key, mimeType, text.getBytes("UTF-8"))
  }

  def get(key: String): Either[Failure, InputStream] = {
    val getObjectRequest = GetObjectRequest.builder()
      .bucket(bucket)
      .key(key)
      .build()

    run(client.s3.getObject(getObjectRequest))
  }

  private def unzipBytes (data: Array[Byte]): String = {
    Using.resource(new ByteArrayInputStream(data)){ byteStream =>
      Using.resource(new GZIPInputStream(byteStream)) { gzipStream =>
        val decompressedData = gzipStream.readAllBytes()
        new String(decompressedData, StandardCharsets.UTF_8)
      }
    }
  }

  def getGzippedText(key: String): Either[Failure, String] = {
    get(key).map {stream =>
      val allBytes = stream.readAllBytes()
      unzipBytes(allBytes)
    }
  }

  def getSignedUrl(key: String): Either[Failure, String] = {
    val getObjectRequest = GetObjectRequest.builder()
      .bucket(bucket)
      .key(key)
      .build()

    val presignRequest = GetObjectPresignRequest.builder()
      .signatureDuration(Duration.ofHours(24))
      .getObjectRequest(getObjectRequest)
      .build()

    run(presigner.presignGetObject(presignRequest).url().toString)
  }

  def getUploadSignedUrl(key: String): Either[Failure, String] = {
    val putObjectRequest = PutObjectRequest.builder()
      .bucket(bucket)
      .key(key)
      .build()

    val presignRequest = PutObjectPresignRequest.builder()
      .signatureDuration(Duration.ofHours(24))
      .putObjectRequest(putObjectRequest)
      .build()

    run(presigner.presignPutObject(presignRequest).url().toString)
  }

  def getMetadata(key: String): Either[Failure, ObjectMetadata] = run {

    val headObjectRequest = HeadObjectRequest.builder()
      .bucket(bucket)
      .key(key)
      .build()


    val response = client.s3.headObject(headObjectRequest)

    ObjectMetadata(response.contentLength(), response.contentType())
  }

  def delete(key: String): Either[Failure, Unit] = {
    val dataKeyDeleteRequest = DeleteObjectRequest.builder()
      .bucket(bucket)
      .key(key)
      .build()
    run(client.s3.deleteObject(dataKeyDeleteRequest))
  }

  def deleteMultiple(keys: Set[String]): Either[Failure, Unit] = {
    val objectIds = keys.map { key =>
      ObjectIdentifier.builder().key(key).build()
    }

    val delete = Delete.builder()
      .objects(objectIds.asJava)
      .build()

    val request = DeleteObjectsRequest.builder()
      .bucket(bucket)
      .delete(delete)
      .build()

    run(client.s3.deleteObjects(request))
  }

  def list(prefix: String): Either[Failure, List[String]] = {

    val listObjectsRequest = ListObjectsV2Request.builder()
      .bucket(bucket)
      .prefix(prefix)
      .build()

    run(client.s3.listObjectsV2(listObjectsRequest).contents().asScala.toList.map(_.key()))
  }

  private def run[T](fn: => T): Either[Failure, T] = try {
    Right(fn)
  } catch {
    case NonFatal(err) =>
      Left(AwsErrors.exceptionToFailure.lift(err).getOrElse(UnknownFailure(err)))
  }
}

object S3ObjectStorage {
  def apply(client: S3Client, presigner: S3Presigner, bucket: String): Either[Failure, S3ObjectStorage] = {
    try {
      if (!client.doesBucketExist(bucket)) {
        Left(IllegalStateFailure(s"Bucket $bucket does not exist"))
      } else {
        Right(new S3ObjectStorage(client, presigner, bucket))
      }
    } catch {
      case ex: Exception => Left(UnknownFailure(ex))
    }
  }
}
