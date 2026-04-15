package com.gu.pfi.cli

import java.nio.file.{Files, Path}
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class PreFlightCheckTest extends AnyFunSuite with Matchers {

  private def withTempDir(fn: Path => Unit): Unit = {
    val dir = Files.createTempDirectory("preflight-test")
    try fn(dir)
    finally {
      Files.walk(dir).sorted(java.util.Comparator.reverseOrder()).forEach(Files.delete(_))
    }
  }

  test("scan counts files and sizes correctly") {
    withTempDir { dir =>
      val data = "hello world"
      Files.write(dir.resolve("file1.txt"), data.getBytes)
      Files.write(dir.resolve("file2.txt"), data.getBytes)

      val result = PreFlightCheck.scan(dir)
      result.fileCount must be(2)
      result.totalBytes must be(data.length * 2)
      result.dirCount must be(0)
    }
  }

  test("scan counts subdirectories") {
    withTempDir { dir =>
      val subdir = Files.createDirectory(dir.resolve("subdir"))
      Files.write(subdir.resolve("nested.txt"), "content".getBytes)

      val result = PreFlightCheck.scan(dir)
      result.fileCount must be(1)
      result.dirCount must be(1)
    }
  }

  test("scan returns zero for empty directory") {
    withTempDir { dir =>
      val result = PreFlightCheck.scan(dir)
      result.fileCount must be(0)
      result.totalBytes must be(0)
      result.dirCount must be(0)
    }
  }

  test("formatSummary includes source and destination") {
    val result = PreFlightCheck.ScanResult(42, 1024 * 1024 * 10, 5)
    val summary = PreFlightCheck.formatSummary(Path.of("/data/upload"), "myCollection/myIngestion", result)

    summary must include("/data/upload")
    summary must include("myCollection/myIngestion")
    summary must include("42")
    summary must include("5")
  }
}
