package com.gu.pfi.cli

import java.nio.file.{Files, Path}
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class IngestionCheckpointTest extends AnyFunSuite with Matchers {

  test("records and queries uploaded files") {
    val checkpoint = new IngestionCheckpoint("test/ingestion-" + System.nanoTime())
    try {
      checkpoint.load() must be(Set.empty)
      checkpoint.start()

      checkpoint.recordSuccess("/data/file1.txt", "data/123_abc.data")
      checkpoint.recordSuccess("/data/file2.txt", "data/456_def.data")

      checkpoint.isAlreadyUploaded("/data/file1.txt") must be(true)
      checkpoint.isAlreadyUploaded("/data/file2.txt") must be(true)
      checkpoint.isAlreadyUploaded("/data/file3.txt") must be(false)
      checkpoint.previouslyUploadedCount must be(2)
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
      checkpoint1.recordSuccess("/data/a.txt", "data/111_aaa.data")
      checkpoint1.recordSuccess("/data/b.txt", "data/222_bbb.data")
      checkpoint1.close()

      // Second run: load previous progress
      val checkpoint2 = new IngestionCheckpoint(name)
      val loaded = checkpoint2.load()
      loaded must contain("/data/a.txt")
      loaded must contain("/data/b.txt")
      loaded.size must be(2)
      checkpoint2.isAlreadyUploaded("/data/a.txt") must be(true)
    } finally {
      checkpoint1.delete()
    }
  }

  test("delete removes the checkpoint file") {
    val checkpoint = new IngestionCheckpoint("test/delete-" + System.nanoTime())
    checkpoint.start()
    checkpoint.recordSuccess("/data/x.txt", "data/333_ccc.data")
    val path = checkpoint.checkpointPath
    Files.exists(path) must be(true)

    checkpoint.delete()
    Files.exists(path) must be(false)
  }
}
