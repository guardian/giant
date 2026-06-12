package com.gu.pfi.cli.service

import java.net.{URI => JavaUri}
import java.nio.file.Path

import com.gu.pfi.cli.DownloadWorkspaceCommandOptions
import model.Uri
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import utils.Logging

/**
  * Reads blobs (the original ingested files) directly from the "collections" S3 bucket.
  *
  * Blobs are stored under a key derived from their content hash via [[model.Uri.toStoragePath]]
  * (e.g. blob `abcdef123…` lives at `a/b/c/d/e/f/abcdef123…`). This mirrors how the backend's
  * `S3ObjectStorage` reads them in `GetBlobObjectData`.
  */
trait BlobS3Client {
  /** Streams the blob for `blobUri` directly to `dest`, returning the number of bytes written. */
  def downloadTo(blobUri: String, dest: Path): Long
}

class DefaultBlobS3Client(cmd: DownloadWorkspaceCommandOptions, credentials: AwsCredentialsProvider) extends BlobS3Client with Logging {
  private val s3: S3Client = (cmd.garageAccessKey.toOption, cmd.garageSecretKey.toOption, cmd.garageEndpoint.toOption) match {
    case (Some(_), Some(_), Some(garageEndpoint)) =>
      S3Client.builder()
        .endpointOverride(new JavaUri(garageEndpoint))
        .credentialsProvider(credentials)
        .forcePathStyle(true)
        .region(Region.of(cmd.region()))
        .build()

    case _ =>
      logger.info("Not all garage parameters were supplied, using AWS S3")
      S3Client.builder()
        .credentialsProvider(credentials)
        .region(Region.of(cmd.region()))
        .build()
  }

  override def downloadTo(blobUri: String, dest: Path): Long = {
    val key = Uri(blobUri).toStoragePath
    val request = GetObjectRequest.builder().bucket(cmd.bucket()).key(key).build()
    // getObject(request, path) streams straight to disk and returns the object's metadata
    val response = s3.getObject(request, dest)
    response.contentLength().longValue()
  }
}
