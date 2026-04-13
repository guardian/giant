package com.gu.pfi.cli

import java.nio.file.{Files, Path}
import scala.jdk.StreamConverters._

/**
 * Scans a directory before ingestion and reports what will be uploaded
 */
object PreFlightCheck {

  case class ScanResult(fileCount: Long, totalBytes: Long, dirCount: Long)

  def scan(root: Path): ScanResult = {
    var fileCount = 0L
    var totalBytes = 0L
    var dirCount = 0L

    val stream = Files.walk(root)
    try {
      stream.toScala(LazyList).foreach { path =>
        if (Files.isRegularFile(path) && !FileFilters.isJunkFile(path)) {
          fileCount += 1
          totalBytes += Files.size(path)
        } else if (Files.isDirectory(path) && path != root) {
          dirCount += 1
        }
      }
    } finally {
      stream.close()
    }

    ScanResult(fileCount, totalBytes, dirCount)
  }

  def formatSummary(source: Path, ingestionUri: String, result: ScanResult): String = {
    val lines = List(
      "",
      ConsoleColors.bold("Ingestion summary"),
      s"  Source:      ${source.toAbsolutePath}",
      s"  Destination: $ingestionUri",
      s"  Files:       ${result.fileCount}",
      s"  Directories: ${result.dirCount}",
      s"  Total size:  ${formatBytes(result.totalBytes)}",
      ""
    )
    lines.mkString("\n")
  }

  private def formatBytes(bytes: Long): String = {
    if (bytes < 1024) s"${bytes} B"
    else if (bytes < 1024 * 1024) f"${bytes / 1024.0}%.1f KB"
    else if (bytes < 1024L * 1024 * 1024) f"${bytes / (1024.0 * 1024)}%.1f MB"
    else f"${bytes / (1024.0 * 1024 * 1024)}%.2f GB"
  }
}
