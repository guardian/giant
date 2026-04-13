package com.gu.pfi.cli

import java.io.{BufferedReader, BufferedWriter, FileReader, FileWriter}
import java.nio.file.{Files, Path}
import java.util.concurrent.{ConcurrentLinkedQueue, Executors}
import java.util.concurrent.atomic.AtomicInteger

import com.amazonaws.services.s3.AmazonS3
import com.amazonaws.services.s3.model.ListObjectsV2Request
import com.gu.pfi.cli.service.CliIngestionService
import _root_.model.{VerifyRequest, VerifyRequestFile, VerifyResponse}
import _root_.model.ingestion.{IngestMetadata, dataPrefix, dataSuffix, metadataPrefix, metadataSuffix}
import play.api.libs.json.Json
import utils.{IngestionVerification, Logging}
import utils.attempt.AttemptAwait._

import scala.concurrent.ExecutionContext
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

    // Per-directory breakdown
    lines ++= formatDirectoryBreakdown(localFiles, uploadedUris, ingestionUri)

    if (missing.nonEmpty && missing.size <= 20) {
      lines += ""
      lines += ConsoleColors.warning(s"Missing files:")
      missing.foreach { f =>
        lines += s"  $f"
      }
    }

    lines += ""
    lines.result().mkString("\n")
  }

  /**
   * After generating a checkpoint (S3 + index), print a per-directory summary
   * based on the checkpoint file.  This gives the most complete picture of
   * which directories still need uploading.
   */
  def printCheckpointSummary(checkpointPath: Path, localPath: Path, ingestionUri: String): Unit = {
    val checkpointed = loadCheckpointPaths(checkpointPath)
    val prefix = ingestionUri + "/"

    val stream = Files.walk(localPath)
    val localFiles: List[String] = try {
      stream.iterator().asScala
        .filter(p => Files.isRegularFile(p))
        .map(_.toAbsolutePath.toString)
        .toList
    } finally {
      stream.close()
    }

    val uploaded = localFiles.filter(checkpointed.contains).size
    val total = localFiles.size

    logger.info("")
    logger.info(ConsoleColors.bold(s"Checkpoint summary for $ingestionUri"))
    logger.info(s"  Files on disk:         $total")
    logger.info(s"  Files in checkpoint:   $uploaded")
    logger.info(s"  Files still to upload: ${total - uploaded}")

    if (total > 0) {
      val pct = uploaded * 100.0 / total
      logger.info(s"  Progress:              ${f"$pct%.1f"}%%")
    }

    // Group by top-level directory
    val byDir = localFiles.groupBy { absolutePath =>
      val relative = localPath.toAbsolutePath.relativize(java.nio.file.Paths.get(absolutePath))
      if (relative.getNameCount > 1) relative.getName(0).toString else "."
    }.toList.sortBy(_._1)

    if (byDir.size > 1) {
      logger.info("")
      logger.info(ConsoleColors.bold("  Directory breakdown:"))

      // Find max directory name length for alignment
      val maxNameLen = byDir.map(_._1.length).max.min(40)

      byDir.foreach { case (dir, files) =>
        val dirUploaded = files.count(checkpointed.contains)
        val dirTotal = files.size
        val pct = if (dirTotal > 0) dirUploaded * 100.0 / dirTotal else 100.0
        val status = if (dirUploaded == dirTotal) ConsoleColors.green("✓") else " "
        val paddedDir = dir.padTo(maxNameLen, ' ')
        logger.info(f"  $status $paddedDir  $dirUploaded%6d / $dirTotal%-6d  ($pct%.0f%%)")
      }
    }
  }

  /**
   * Group files by their first path component after the ingestion URI prefix
   * and return formatted lines showing per-directory upload status.
   */
  private def formatDirectoryBreakdown(
    localFiles: List[String], uploadedUris: Set[String], ingestionUri: String
  ): List[String] = {
    val prefix = ingestionUri + "/"

    val byDir = localFiles.groupBy { uri =>
      val relative = uri.stripPrefix(prefix)
      val slash = relative.indexOf('/')
      if (slash > 0) relative.substring(0, slash) else "."
    }.toList.sortBy(_._1)

    if (byDir.size <= 1) return Nil

    val lines = List.newBuilder[String]
    lines += ""
    lines += ConsoleColors.bold("  Directory breakdown:")

    val maxNameLen = byDir.map(_._1.length).max.min(40)

    byDir.foreach { case (dir, files) =>
      val dirUploaded = files.count(uploadedUris.contains)
      val dirTotal = files.size
      val pct = if (dirTotal > 0) dirUploaded * 100.0 / dirTotal else 100.0
      val status = if (dirUploaded == dirTotal) ConsoleColors.green("✓") else " "
      val paddedDir = dir.padTo(maxNameLen, ' ')
      lines += f"  $status $paddedDir  $dirUploaded%6d / $dirTotal%-6d  ($pct%.0f%%)"
    }

    lines.result()
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
      s"✓ Generated checkpoint with $count files from S3 at ${checkpoint.checkpointPath}"
    ))
    checkpoint.checkpointPath
  }

  /**
   * Augment an existing checkpoint with files that have already been processed
   * by the backend into the index.  These files are no longer in the S3 ingest
   * bucket but don't need to be re-uploaded either.
   *
   * Walks the local directory, batch-checks every file against the backend's
   * verify endpoint, and appends any file that IS in the index to the checkpoint.
   */
  def augmentCheckpointFromIndex(
    ingestionService: CliIngestionService, checkpointPath: Path, localPath: Path, ingestionUri: String
  )(implicit ec: ExecutionContext): Unit = {
    logger.info(ConsoleColors.dim("\nChecking backend index for files already processed..."))

    // Load existing checkpoint entries to avoid duplicates
    val existing = loadCheckpointPaths(checkpointPath)

    val rootName = localPath.getFileName.toString
    val stream = Files.walk(localPath)
    val allFiles: List[Path] = try {
      stream.iterator().asScala
        .filter(p => Files.isRegularFile(p))
        .toList
    } finally {
      stream.close()
    }

    val writer = new BufferedWriter(new FileWriter(checkpointPath.toFile, true))
    var addedFromIndex = 0
    var totalChecked = 0

    try {
      allFiles.grouped(IngestionVerification.BATCH_SIZE).foreach { batch =>
        val filePaths = batch.map { file =>
          val relativePath = s"$rootName/${localPath.relativize(file)}"
          (file, relativePath)
        }

        val request = VerifyRequest(filePaths.map { case (_, relPath) =>
          VerifyRequestFile(relPath, None)
        })

        try {
          val requestJson = Json.stringify(Json.toJson(request))
          val rawResponse = ingestionService.http.post(
            s"/api/collections/$ingestionUri/verifyFiles", requestJson
          ).await()
          val response = Json.parse(rawResponse.body().string()).as[VerifyResponse]

          val notIndexed = response.filesNotIndexed.toSet
          filePaths.foreach { case (file, relPath) =>
            val absolutePath = file.toAbsolutePath.toString
            if (!notIndexed.contains(relPath) && !existing.contains(absolutePath)) {
              writer.write(s"$absolutePath\tindexed")
              writer.newLine()
              addedFromIndex += 1
            }
          }
        } catch {
          case e: Exception =>
            logger.warn(ConsoleColors.dim(s"  Failed to verify batch: ${e.getMessage}"))
        }

        totalChecked += batch.size
        if (totalChecked % 5000 == 0) {
          logger.info(ConsoleColors.dim(
            s"  Checked $totalChecked/${allFiles.size} files against index ($addedFromIndex found in index)"
          ))
        }
      }
    } finally {
      writer.flush()
      writer.close()
    }

    logger.info(ConsoleColors.success(
      s"✓ Added $addedFromIndex files from backend index to checkpoint (total checked: $totalChecked)"
    ))
    logger.info(ConsoleColors.dim(
      "  Re-run your ingest command — it will skip all checkpointed files and only upload what's missing"
    ))
  }

  private def loadCheckpointPaths(checkpointPath: Path): Set[String] = {
    if (!Files.exists(checkpointPath)) return Set.empty
    val paths = Set.newBuilder[String]
    val reader = new BufferedReader(new FileReader(checkpointPath.toFile))
    try {
      var line = reader.readLine()
      while (line != null) {
        if (line.nonEmpty) {
          val tab = line.indexOf('\t')
          if (tab >= 0) paths += line.substring(0, tab) else paths += line
        }
        line = reader.readLine()
      }
    } finally {
      reader.close()
    }
    paths.result()
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
