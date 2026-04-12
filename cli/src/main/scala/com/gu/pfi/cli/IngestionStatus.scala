package com.gu.pfi.cli

import java.nio.file.{Files, Path}
import java.util.concurrent.{ConcurrentLinkedQueue, Executors}
import java.util.concurrent.atomic.AtomicInteger

import com.amazonaws.services.s3.AmazonS3
import com.amazonaws.services.s3.model.ListObjectsV2Request
import _root_.model.ingestion.{IngestMetadata, dataPrefix, dataSuffix, metadataPrefix, metadataSuffix}
import play.api.libs.json.Json
import utils.Logging

import scala.jdk.CollectionConverters._

/**
 * Checks the ingest S3 bucket to report which files have been uploaded
 * for a given ingestion, and optionally compares against a local directory
 * to show what's missing.
 */
object IngestionStatus extends Logging {

  private val ReadParallelism = 20

  case class UploadedFile(uri: String, size: Long, metadataKey: String)

  case class StatusResult(
    uploaded: List[UploadedFile],
    metadataCount: Int,
    totalUploadedBytes: Long
  )

  /**
   * Lists all metadata objects in the ingest bucket and reads each one to
   * extract the original file URI and size.  Filters to only those belonging
   * to the given ingestion.
   *
   * Metadata reads are parallelised to keep the scan fast even for buckets
   * with hundreds of thousands of objects.
   */
  def checkBucket(s3: AmazonS3, bucket: String, ingestionUri: String): StatusResult = {
    logger.info(ConsoleColors.dim(s"Scanning S3 bucket '$bucket' for metadata files..."))

    val allMetadataKeys = listMetadataKeys(s3, bucket)
    val total = allMetadataKeys.size
    logger.info(ConsoleColors.dim(s"Found $total metadata files in bucket, reading ($ReadParallelism parallel)..."))

    val uploaded = readMetadataParallel(s3, bucket, allMetadataKeys, ingestionUri)

    StatusResult(
      uploaded = uploaded.sortBy(_.uri),
      metadataCount = total,
      totalUploadedBytes = uploaded.map(_.size).sum
    )
  }

  def formatStatus(result: StatusResult, ingestionUri: String): String = {
    val lines = List.newBuilder[String]
    lines += ""
    lines += ConsoleColors.bold(s"Upload status for $ingestionUri")
    lines += s"  Files uploaded to S3: ${result.uploaded.size}"
    lines += s"  Total size:           ${formatBytes(result.totalUploadedBytes)}"
    lines += ""
    lines.result().mkString("\n")
  }

  def formatComparison(result: StatusResult, localPath: Path, ingestionUri: String): String = {
    val uploadedUris = result.uploaded.map(_.uri).toSet

    // Walk local directory and build the set of expected URIs
    val localFiles = listLocalFiles(localPath, ingestionUri)

    val missing = localFiles.filterNot(uploadedUris.contains).sorted
    val uploaded = localFiles.filter(uploadedUris.contains)

    val lines = List.newBuilder[String]
    lines += ""
    lines += ConsoleColors.bold(s"Upload status for $ingestionUri")
    lines += s"  Files on disk:        ${localFiles.size}"
    lines += s"  Files uploaded to S3: ${uploaded.size}"
    lines += s"  Files not yet in S3:  ${missing.size}"
    lines += s"  Total uploaded size:  ${formatBytes(result.totalUploadedBytes)}"

    if (localFiles.nonEmpty) {
      val pct = (uploaded.size * 100.0 / localFiles.size)
      lines += s"  Progress:             ${f"$pct%.1f"}%%"
    }

    if (missing.nonEmpty) {
      lines += ""
      val displayCount = Math.min(missing.size, 20)
      lines += ConsoleColors.warning(s"First $displayCount missing files:")
      missing.take(20).foreach { f =>
        lines += s"  $f"
      }
      if (missing.size > 20) {
        lines += ConsoleColors.dim(s"  ... and ${missing.size - 20} more")
      }
    } else if (localFiles.nonEmpty) {
      lines += ""
      lines += ConsoleColors.success("✓ All local files are present in S3")
    }

    lines += ""
    lines.result().mkString("\n")
  }

  private def listMetadataKeys(s3: AmazonS3, bucket: String): List[String] = {
    val keys = List.newBuilder[String]
    var request = new ListObjectsV2Request()
      .withBucketName(bucket)
      .withPrefix(metadataPrefix)
    var listed = 0

    var done = false
    while (!done) {
      val result = s3.listObjectsV2(request)
      val objects = result.getObjectSummaries.asScala.toList

      objects.foreach { obj =>
        if (obj.getKey.endsWith(metadataSuffix)) {
          keys += obj.getKey
        }
      }

      listed += objects.size
      if (listed % 10000 == 0 || !result.isTruncated) {
        logger.info(ConsoleColors.dim(s"  Listed $listed objects..."))
      }

      if (result.isTruncated) {
        request = request.withContinuationToken(result.getNextContinuationToken)
      } else {
        done = true
      }
    }

    keys.result()
  }

  private def readMetadataParallel(
    s3: AmazonS3, bucket: String, keys: List[String], ingestionUri: String
  ): List[UploadedFile] = {
    val total = keys.size
    val results = new ConcurrentLinkedQueue[UploadedFile]()
    val processed = new AtomicInteger(0)
    val errors = new AtomicInteger(0)
    val lastReported = new AtomicInteger(0)

    val pool = Executors.newFixedThreadPool(ReadParallelism)
    try {
      val futures = keys.map { key =>
        pool.submit(new Runnable {
          override def run(): Unit = {
            readMetadata(s3, bucket, key, ingestionUri).foreach(results.add)

            val count = processed.incrementAndGet()
            // Report progress every 1000 files or at the end
            val last = lastReported.get()
            if (count - last >= 1000 || count == total) {
              if (lastReported.compareAndSet(last, count)) {
                val matched = results.size()
                val errCount = errors.get()
                val pct = count * 100 / total
                val errStr = if (errCount > 0) s", $errCount errors" else ""
                logger.info(ConsoleColors.dim(
                  s"  Read $count/$total metadata files ($pct%%), $matched matched$errStr"
                ))
              }
            }
          }
        })
      }
      // Wait for all to complete
      futures.foreach(_.get())
    } finally {
      pool.shutdown()
    }

    results.asScala.toList
  }

  private def readMetadata(s3: AmazonS3, bucket: String, key: String, ingestionUri: String): Option[UploadedFile] = {
    try {
      val obj = s3.getObject(bucket, key)
      val content = new String(obj.getObjectContent.readAllBytes())
      obj.getObjectContent.close()

      val metadata = Json.parse(content).as[IngestMetadata]

      // Only include files belonging to this ingestion
      if (metadata.ingestion == ingestionUri && metadata.file.isRegularFile) {
        Some(UploadedFile(metadata.file.uri.value, metadata.file.size, key))
      } else {
        None
      }
    } catch {
      case e: Exception =>
        logger.warn(ConsoleColors.dim(s"Could not read metadata $key: ${e.getMessage}"))
        None
    }
  }

  /**
   * Generate a checkpoint file from the S3 status result, so that a subsequent
   * `ingest` run will skip files that have already been uploaded.
   *
   * Requires `--path` so we can map ingestion URIs back to absolute local paths
   * (which is what the checkpoint stores).
   */
  def generateCheckpoint(result: StatusResult, localPath: Path, ingestionUri: String): Path = {
    val checkpoint = new IngestionCheckpoint(ingestionUri)
    checkpoint.start()

    val prefix = ingestionUri + "/"
    var count = 0

    result.uploaded.foreach { file =>
      if (file.uri.startsWith(prefix)) {
        val relativePath = file.uri.stripPrefix(prefix)
        val absoluteLocalPath = localPath.resolve(relativePath).toAbsolutePath.toString
        val s3DataKey = deriveDataKey(file.metadataKey)
        checkpoint.recordSuccess(absoluteLocalPath, s3DataKey)
        count += 1
      }
    }

    checkpoint.close()
    logger.info(ConsoleColors.success(
      s"✓ Generated checkpoint with $count files at ${checkpoint.checkpointPath}"
    ))
    logger.info(ConsoleColors.dim(
      "  Re-run your ingest command — it will skip these files and only upload what's missing"
    ))
    checkpoint.checkpointPath
  }

  /**
   * Derive the S3 data key from a metadata key.
   * e.g. "metadata/12345_uuid.metadata.json" -> "data/12345_uuid.data"
   */
  private def deriveDataKey(metadataKey: String): String = {
    val objectId = metadataKey
      .stripPrefix(metadataPrefix)
      .stripSuffix(metadataSuffix)
    s"${dataPrefix}${objectId}${dataSuffix}"
  }

  private def listLocalFiles(localPath: Path, ingestionUri: String): List[String] = {
    val rootName = localPath.getFileName.toString
    val stream = Files.walk(localPath)
    try {
      stream.iterator().asScala
        .filter(p => Files.isRegularFile(p))
        .map { p =>
          val relative = localPath.relativize(p).toString
          s"$ingestionUri/$relative"
        }
        .toList
    } finally {
      stream.close()
    }
  }

  private def formatBytes(bytes: Long): String = {
    if (bytes < 1024) s"${bytes} B"
    else if (bytes < 1024 * 1024) f"${bytes / 1024.0}%.1f KB"
    else if (bytes < 1024L * 1024 * 1024) f"${bytes / (1024.0 * 1024)}%.1f MB"
    else f"${bytes / (1024.0 * 1024 * 1024)}%.2f GB"
  }
}
