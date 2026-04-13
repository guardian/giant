package com.gu.pfi.cli

import java.io.{BufferedReader, BufferedWriter, FileReader, FileWriter}
import java.nio.file.{Files, Path, Paths}

import utils.Logging

/**
 * Tracks which files have been successfully uploaded during an ingestion,
 * allowing interrupted ingestions to be resumed without re-uploading everything.
 *
 * Progress is stored in ~/.pfi-checkpoints/<ingestionUri>.checkpoint
 *
 * Each line in the checkpoint file is: <localFilePath>\t<s3DataKey>
 *
 * On resume the checkpoint is loaded from disk and files already uploaded are
 * skipped.  If the checkpoint file is missing the ingestion starts from
 * scratch — use the `verify` command after indexing completes to find any gaps.
 */
class IngestionCheckpoint(ingestionUri: String, enabled: Boolean = true) extends Logging {
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
    if (!enabled) return Set.empty
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

  def start(): Unit = {
    if (!enabled) return
    Files.createDirectories(checkpointDir)
    writer = Some(new BufferedWriter(new FileWriter(checkpointFile.toFile, true)))
  }

  def recordSuccess(filePath: String, s3DataKey: String): Unit = {
    if (!enabled) return
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
