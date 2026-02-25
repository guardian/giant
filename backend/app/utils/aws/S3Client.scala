package utils.aws

import java.io.{ByteArrayInputStream, InputStream}
import java.nio.file.Path
import software.amazon.awssdk.services.s3.{S3Client => S3ClientV2}
import software.amazon.awssdk.services.s3.model.{HeadBucketRequest, ListObjectsV2Request, ListObjectsV2Response, PutObjectRequest, PutObjectResponse}
import software.amazon.awssdk.transfer.s3.S3TransferManager
import software.amazon.awssdk.transfer.s3.model.{CompletedFileUpload, UploadFileRequest}
import software.amazon.awssdk.transfer.s3.progress.TransferListener.Context.BytesTransferred
import software.amazon.awssdk.transfer.s3.progress.{LoggingTransferListener, TransferListener}

import scala.concurrent.Await
import com.amazonaws.{AmazonServiceException, event}
import services.S3Config
import software.amazon.awssdk.core.sync.RequestBody
import utils.attempt.Attempt
import utils.{AwsCredentials, AwsS3Clients}
import software.amazon.awssdk.regions.Region

import scala.jdk.FutureConverters._
import scala.concurrent.ExecutionContext
import scala.language.implicitConversions

class S3Client(config: S3Config)(implicit executionContext: ExecutionContext) {
  val credentials = AwsCredentials.credentialsV2(accessKey = config.accessKey, secretKey = config.secretKey)
  val (s3: S3ClientV2, tranferManager: S3TransferManager) = AwsS3Clients(credentials, Region.of(config.region), config.endpoint)

  def attemptS3[T](f: => T): Attempt[T] = Attempt.catchNonFatal(f)(AwsErrors.exceptionToFailure)

  // Minio only works with the deprecated method on the client. This is a copy paste into our code to avoid the warnings
  def doesBucketExist(bucket: String): Boolean = try {
    s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build())
    true
  } catch {
    case ase: AmazonServiceException if ase.getStatusCode == 301 || ase.getStatusCode == 403 =>
      true

    case ase: AmazonServiceException if ase.getStatusCode == 404 =>
      false
  }

  // TODO MRB: these should all be attempty
  def putObjectSync(bucket: String, key: String, contentType: Option[String], contentLength: Long, is: InputStream): PutObjectResponse = {
    val request = requestBuilder(bucket, key, contentType, Some(contentLength))

    try {
      s3.putObject(request, RequestBody.fromInputStream(is, contentLength))
    } finally {
      is.close()
    }
  }

  def putObjectSync(bucket: String, key: String, contentType: Option[String], file: Path): PutObjectResponse = {
    val request = requestBuilder(bucket, key, contentType)
    s3.putObject(request, file)
  }

  def putLargeObject(bucket: String, key: String, contentType: Option[String], file: Path,
                     updateCallback: BytesTransferred => Unit = _ => ()): CompletedFileUpload = {

    val request = requestBuilder(bucket, key, contentType)

    val progressListener = new TransferListener {
      override def bytesTransferred(context: BytesTransferred): Unit = {
        updateCallback(context)
      }
    }

    val uploadRequest = UploadFileRequest.builder()
      .putObjectRequest(request)
      .source(file)
      .addTransferListener(progressListener)
      .build()

    //Do we want to wait for an infinite amount of time here?
    val uploadFuture = tranferManager.uploadFile(uploadRequest).completionFuture()
    Await.result(uploadFuture.asScala, scala.concurrent.duration.Duration.Inf)
  }

  def putObjectSync(bucket: String, key: String, contentType: Option[String], data: Array[Byte]): PutObjectResponse = {
    val request = requestBuilder(bucket, key, contentType)
    s3.putObject(
      request,
      RequestBody.fromInputStream(new ByteArrayInputStream(data), data.length))
  }

  def putObject(bucket: String, key: String, contentType: Option[String], data: Array[Byte]): Attempt[PutObjectResponse] = attemptS3 {
    putObjectSync(bucket, key, contentType, data)
  }

  def listObjects(bucket: String, prefix: String): Attempt[ListObjectsV2Response] = {
    val request = ListObjectsV2Request.builder()
      .bucket(bucket)
      .prefix(prefix)
      .build()
    attemptS3(s3.listObjectsV2(request))
  }

  def requestBuilder(bucket: String, key: String, contentType: Option[String], contentLength: Option[Long] = None): PutObjectRequest = {
    val basereq = PutObjectRequest.builder.bucket(bucket).key(key)
    val reqWithContentType = contentType.map(ct => basereq.contentType(ct)).getOrElse(basereq)
    val reqWithContentLength = contentLength.map(cl => reqWithContentType.contentLength(cl)).getOrElse(reqWithContentType)
    reqWithContentLength.build()
  }
}
