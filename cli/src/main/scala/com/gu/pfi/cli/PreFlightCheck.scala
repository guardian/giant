package com.gu.pfi.cli

import java.nio.file.{Files, Path}
import scala.jdk.StreamConverters._

/**
 * Scans a directory before ingestion and reports what will be uploaded
 */
object PreFlightCheck {

  case class ScanResult(fileCount: Long, totalBytes: Long, dirCount: Long, junkCount: Long)

  def scan(root: Path, includeJunk: Boolean = false): ScanResult = {
    val stream = Files.walk(root)
    try {
      stream.toScala(LazyList).foldLeft(ScanResult(0, 0, 0, 0)) { (acc, path) =>
        if (Files.isRegularFile(path)) {
          if (!includeJunk && FileFilters.isJunkFile(path)) {
            acc.copy(junkCount = acc.junkCount + 1)
          } else {
            acc.copy(fileCount = acc.fileCount + 1, totalBytes = acc.totalBytes + Files.size(path))
          }
        } else if (Files.isDirectory(path) && path != root) {
          acc.copy(dirCount = acc.dirCount + 1)
        } else {
          acc
        }
      }
    } finally {
      stream.close()
    }
  }

  def formatSummary(source: Path, ingestionUri: String, result: ScanResult): String = {
    val junkLine =
      if (result.junkCount > 0)
        List(s"  Excluded:    ${result.junkCount} OS junk file(s) (.DS_Store etc) — use --include-junk to upload them")
      else
        Nil

    val lines = List(
      "",
      ConsoleColors.bold("Ingestion summary"),
      s"  Source:      ${source.toAbsolutePath}",
      s"  Destination: $ingestionUri",
      s"  Files:       ${result.fileCount}",
      s"  Directories: ${result.dirCount}",
      s"  Total size:  ${formatBytes(result.totalBytes)}"
    ) ++ junkLine ++ List("")

    lines.mkString("\n")
  }

  private def formatBytes(bytes: Long): String = {
    if (bytes < 1024) s"${bytes} B"
    else if (bytes < 1024 * 1024) f"${bytes / 1024.0}%.1f KB"
    else if (bytes < 1024L * 1024 * 1024) f"${bytes / (1024.0 * 1024)}%.1f MB"
    else f"${bytes / (1024.0 * 1024 * 1024)}%.2f GB"
  }
}
