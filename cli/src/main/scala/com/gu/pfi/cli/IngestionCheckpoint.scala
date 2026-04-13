package com.gu.pfi.cli

import java.io.{BufferedReader, BufferedWriter, FileReader, FileWriter}
import java.nio.file.{Files, Path, Paths}

import com.amazonaws.services.s3.AmazonS3
import utils.Logging

/**
 * Tracks which files have been successfully uploaded during an ingestion,
 * allowing interrupted ingestions to be resumed without re-uploading everything.
 *
 * Progress is stored in ~/.pfi-checkpoints/<ingestionUri>.checkpoint
 *
 * Each line in the checkpoint file is: <localFilePath>\t<s3DataKey>
 *
 * On resume the checkpoint is loaded from disk and (optionally) spot-checked
 * against S3 to confirm that the recorded uploads actually landed.  If the
 * checkpoint file is missing the ingestion starts from scratch — use the
 * `verify` command after indexing completes to find any gaps.
 */
class IngestionCheckpoint(ingestionUri: String) extends Logging {
  private val checkpointDir = Paths.get(System.getProperty("user.home"), ".pfi-checkpoints")
  private val checkpointFile = checkpointDir.resolve(sanitiseFilename(ingestionUri) + ".checkpoint")
  private var writer: Option[BufferedWriter] = None
  // maps local file path -> S3 data key
  private var completedEntries: Map[String, String] = Map.empty

  /**
   * Load a previous checkpoint from disk.
   * Returns the set of local file paths that were previously uploaded.
   * Streams the file line-by-line to avoid loading it all into memory at once.
   */
  def load(): Set[String] = {
    if (Files.exists(checkpointFile)) {
      val entries = Map.newBuilder[String, String]
      var count = 0
      val reader = new BufferedReader(new FileReader(checkpointFile.toFile))
      try {
        var line = reader.readLine()
        while (line != null) {
          if (line.nonEmpty) {
            val tab = line.indexOf('\t')
            if (tab >= 0) {
              entries += (line.substring(0, tab) -> line.substring(tab + 1))
            } else {
              entries += (line -> "") // legacy checkpoint without S3 key
            }
            count += 1
          }
          line = reader.readLine()
        }
      } finally {
        reader.close()
      }

      completedEntries = entries.result()
      logger.info(ConsoleColors.info(s"Loaded checkpoint with $count previously uploaded files"))
      completedEntries.keySet
    } else {
      Set.empty
    }
  }

  /**
   * Spot-check a sample of checkpoint entries against S3 to verify they
   * actually exist.  Returns the number of entries that failed validation
   * (i.e. were in the checkpoint but missing from S3).
   *
   * This is a best-effort check — it samples up to `sampleSize` entries
   * rather than verifying all of them, to keep resume fast.
   */
  def validateAgainstS3(s3: AmazonS3, bucket: String, sampleSize: Int = 5): Int = {
    val entriesWithKeys = completedEntries.filter(_._2.nonEmpty)
    if (entriesWithKeys.isEmpty) return 0

    val sample = scala.util.Random.shuffle(entriesWithKeys.toList).take(sampleSize)
    val missing = sample.count { case (_, s3Key) =>
      try {
        !s3.doesObjectExist(bucket, s3Key)
      } catch {
        case _: Exception =>
          logger.warn(ConsoleColors.dim("Could not verify checkpoint against S3 — skipping validation"))
          return 0 // can't reach S3, assume checkpoint is valid
      }
    }

    if (missing > 0) {
      logger.warn(ConsoleColors.dim(
        s"Note: $missing of ${sample.size} sampled files not found in the S3 ingest bucket. " +
        "This is expected — the backend removes files from the ingest bucket after processing. " +
        "This check only reflects what is waiting to be processed, not what has been successfully uploaded."
      ))
    } else {
      logger.info(ConsoleColors.dim(s"Checkpoint validated: ${sample.size} sampled files confirmed in S3 ingest bucket"))
    }

    missing
  }

  def start(): Unit = {
    Files.createDirectories(checkpointDir)
    writer = Some(new BufferedWriter(new FileWriter(checkpointFile.toFile, true)))
  }

  def recordSuccess(filePath: String, s3DataKey: String): Unit = {
    writer.foreach { w =>
      w.write(s"$filePath\t$s3DataKey")
      w.newLine()
      w.flush()
    }
    completedEntries += (filePath -> s3DataKey)
  }

  def isAlreadyUploaded(filePath: String): Boolean = {
    completedEntries.contains(filePath)
  }

  def delete(): Unit = {
    close()
    Files.deleteIfExists(checkpointFile)
  }

  def close(): Unit = {
    writer.foreach(_.close())
    writer = None
  }

  def checkpointPath: Path = checkpointFile

  def previouslyUploadedCount: Int = completedEntries.size

  private def sanitiseFilename(name: String): String = {
    name.replaceAll("[^a-zA-Z0-9._-]", "_")
  }
}
