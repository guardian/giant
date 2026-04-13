package com.gu.pfi.cli

import java.nio.file.Path

/**
 * Tracks and formats progress information for long-running operations
 */
class ProgressTracker(operationName: String, totalExpected: Long = 0, rootPath: Option[Path] = None) {
  private var startTime: Long = System.currentTimeMillis()
  private var totalProcessed: Int = 0
  private var totalFailed: Int = 0
  private var totalSizeBytes: Long = 0
  private var currentTopDir: String = ""
  
  def start(): Unit = {
    startTime = System.currentTimeMillis()
    println(ConsoleColors.info(s"Starting $operationName..."))
  }

  def noteDirectory(filePath: Path): Unit = {
    rootPath.foreach { root =>
      val relative = root.relativize(filePath)
      val topDir = if (relative.getNameCount > 1) relative.getName(0).toString else "."
      if (topDir != currentTopDir) {
        currentTopDir = topDir
        val pct = if (totalExpected > 0) f" (${(totalProcessed + totalFailed) * 100.0 / totalExpected}%.0f%% of this run done)" else ""
        println(ConsoleColors.info(s"  → $topDir$pct"))
      }
    }
  }
  
  def updateBatch(successful: Int, failed: Int, bytesProcessed: Long): Unit = {
    totalProcessed += successful
    totalFailed += failed
    totalSizeBytes += bytesProcessed
    
    val elapsed = (System.currentTimeMillis() - startTime) / 1000.0
    val rate = if (elapsed > 0) totalProcessed / elapsed else 0
    
    val status = if (totalFailed > 0) {
      ConsoleColors.yellow(s"⚠ $totalProcessed processed, $totalFailed failed")
    } else {
      ConsoleColors.green(s"✓ $totalProcessed processed")
    }
    
    val pct = if (totalExpected > 0) f" ${(totalProcessed + totalFailed) * 100.0 / totalExpected}%.1f%% of this run" else ""
    val throughput = ConsoleColors.dim(f"(${rate}%.1f files/sec, ${formatBytes(totalSizeBytes)}$pct)")
    
    println(s"$status $throughput")
  }
  
  def complete(): Unit = {
    val elapsed = (System.currentTimeMillis() - startTime) / 1000.0
    val minutes = (elapsed / 60).toInt
    val seconds = (elapsed % 60).toInt
    
    val timeStr = if (minutes > 0) {
      s"${minutes}m ${seconds}s"
    } else {
      f"${elapsed}%.1fs"
    }
    
    if (totalFailed > 0) {
      println(ConsoleColors.warning(
        s"⚠ $operationName completed with errors: $totalProcessed successful, $totalFailed failed (${formatBytes(totalSizeBytes)} in $timeStr)"
      ))
    } else {
      println(ConsoleColors.success(
        s"✓ $operationName completed: $totalProcessed files, ${formatBytes(totalSizeBytes)} in $timeStr"
      ))
    }
  }
  
  def fail(message: String): Unit = {
    println(ConsoleColors.error(s"✗ $operationName failed: $message"))
  }
  
  private def formatBytes(bytes: Long): String = {
    if (bytes < 1024) {
      s"${bytes}B"
    } else if (bytes < 1024 * 1024) {
      f"${bytes / 1024.0}%.1fKB"
    } else if (bytes < 1024 * 1024 * 1024) {
      f"${bytes / (1024.0 * 1024)}%.1fMB"
    } else {
      f"${bytes / (1024.0 * 1024 * 1024)}%.2fGB"
    }
  }
}

object ProgressTracker {
  def apply(operationName: String): ProgressTracker = new ProgressTracker(operationName)
  def apply(operationName: String, totalExpected: Long, rootPath: Path): ProgressTracker =
    new ProgressTracker(operationName, totalExpected, Some(rootPath))
}
