package com.gu.pfi.cli

import java.nio.file.Files

import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class IngestionCheckpointTest extends AnyFunSuite with Matchers {

  test("records and queries uploaded files") {
    val checkpoint = new IngestionCheckpoint("test/ingestion-" + System.nanoTime())
    try {
      checkpoint.load() must be(Set.empty)
      checkpoint.start()

      checkpoint.recordSuccess("/data/file1.txt", 100, 1000)
      checkpoint.recordSuccess("/data/file2.txt", 200, 2000)

      checkpoint.isAlreadyUploaded("/data/file1.txt", 100, 1000) must be(true)
      checkpoint.isAlreadyUploaded("/data/file2.txt", 200, 2000) must be(true)
      checkpoint.isAlreadyUploaded("/data/file3.txt", 300, 3000) must be(false)
      checkpoint.previouslyUploadedCount must be(2)
    } finally {
      checkpoint.delete()
    }
  }

  test("a file that changed on disk does not count as uploaded") {
    val checkpoint = new IngestionCheckpoint("test/changed-" + System.nanoTime())
    try {
      checkpoint.start()
      checkpoint.recordSuccess("/data/file.txt", 100, 1000)

      checkpoint.isAlreadyUploaded("/data/file.txt", 999, 1000) must be(false)
      checkpoint.isAlreadyUploaded("/data/file.txt", 100, 9999) must be(false)
      checkpoint.isAlreadyUploaded("/data/file.txt", 100, 1000) must be(true)
    } finally {
      checkpoint.delete()
    }
  }

  test("loads checkpoint from disk on resume") {
    val name = "test/resume-" + System.nanoTime()

    // First run: write some progress
    val checkpoint1 = new IngestionCheckpoint(name)
    try {
      checkpoint1.start()
      checkpoint1.recordSuccess("/data/a.txt", 10, 100)
      checkpoint1.recordSuccess("/data/b.txt", 20, 200)
      checkpoint1.close()

      // Second run: load previous progress
      val checkpoint2 = new IngestionCheckpoint(name)
      val loaded = checkpoint2.load()
      loaded must contain("/data/a.txt")
      loaded must contain("/data/b.txt")
      loaded.size must be(2)
      checkpoint2.isAlreadyUploaded("/data/a.txt", 10, 100) must be(true)
      checkpoint2.isAlreadyUploaded("/data/a.txt", 10, 999) must be(false)
    } finally {
      checkpoint1.delete()
    }
  }

  test("load skips malformed lines such as a torn final line") {
    val name = "test/torn-" + System.nanoTime()

    val checkpoint1 = new IngestionCheckpoint(name)
    try {
      checkpoint1.start()
      checkpoint1.recordSuccess("/data/good.txt", 10, 100)
      checkpoint1.close()

      // Simulate a crash mid-write: append a truncated line
      Files.write(
        checkpoint1.checkpointPath,
        "/data/torn.txt\t12".getBytes,
        java.nio.file.StandardOpenOption.APPEND
      )

      val checkpoint2 = new IngestionCheckpoint(name)
      checkpoint2.load() must be(Set("/data/good.txt"))
    } finally {
      checkpoint1.delete()
    }
  }

  test("delete removes the checkpoint file") {
    val checkpoint = new IngestionCheckpoint("test/delete-" + System.nanoTime())
    checkpoint.start()
    checkpoint.recordSuccess("/data/x.txt", 10, 100)
    val path = checkpoint.checkpointPath
    Files.exists(path) must be(true)

    checkpoint.delete()
    Files.exists(path) must be(false)
  }
}
