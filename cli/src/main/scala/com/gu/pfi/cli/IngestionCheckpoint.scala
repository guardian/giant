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
 * Each line in the checkpoint file is: <localFilePath>\t<sizeBytes>\t<mtimeMillis>
 *
 * A file only counts as already uploaded if its path, size and modification time
 * all match the checkpoint — a file that changed on disk between runs is treated
 * as new and re-uploaded rather than silently skipped.
 *
 * On resume the checkpoint is loaded from disk and files already uploaded are
 * skipped.  If the checkpoint file is missing the ingestion starts from
 * scratch — use the `verify` command after indexing completes to find any gaps.
 */
class IngestionCheckpoint(ingestionUri: String, enabled: Boolean = true) extends Logging {
  private case class FileStamp(size: Long, mtimeMillis: Long)

  private val checkpointDir = Paths.get(System.getProperty("user.home"), ".pfi-checkpoints")
  private val checkpointFile = checkpointDir.resolve(sanitiseFilename(ingestionUri) + ".checkpoint")
  private var writer: Option[BufferedWriter] = None
  private var completedEntries: Map[String, FileStamp] = Map.empty

  /**
   * Load a previous checkpoint from disk.
   * Returns the set of local file paths that were previously uploaded.
   * Streams the file line-by-line to avoid loading it all into memory at once.
   * Malformed lines (e.g. a torn final line from a crash mid-write) are skipped.
   */
  def load(): Set[String] = {
    if (!enabled) return Set.empty
    if (Files.exists(checkpointFile)) {
      val entries = Map.newBuilder[String, FileStamp]
      val reader = new BufferedReader(new FileReader(checkpointFile.toFile))
      try {
        var line = reader.readLine()
        while (line != null) {
          parseLine(line).foreach(entries += _)
          line = reader.readLine()
        }
      } finally {
        reader.close()
      }

      completedEntries = entries.result()
      logger.info(ConsoleColors.info(s"Loaded checkpoint with ${completedEntries.size} previously uploaded files"))
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

  def recordSuccess(filePath: String, size: Long, mtimeMillis: Long): Unit = {
    if (!enabled) return
    writer.foreach { w =>
      w.write(s"$filePath\t$size\t$mtimeMillis")
      w.newLine()
      w.flush()
    }
    completedEntries += (filePath -> FileStamp(size, mtimeMillis))
  }

  def isAlreadyUploaded(filePath: String, size: Long, mtimeMillis: Long): Boolean = {
    completedEntries.get(filePath).contains(FileStamp(size, mtimeMillis))
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

  private def parseLine(line: String): Option[(String, FileStamp)] = {
    line.split('\t') match {
      case Array(path, size, mtime) if path.nonEmpty =>
        try Some(path -> FileStamp(size.toLong, mtime.toLong))
        catch { case _: NumberFormatException => None }
      case _ =>
        None
    }
  }

  private def sanitiseFilename(name: String): String = {
    name.replaceAll("[^a-zA-Z0-9._-]", "_")
  }
}
