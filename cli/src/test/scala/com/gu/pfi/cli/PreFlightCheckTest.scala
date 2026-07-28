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

  test("scan excludes junk files by default but counts them") {
    withTempDir { dir =>
      Files.write(dir.resolve("real.txt"), "content".getBytes)
      Files.write(dir.resolve(".DS_Store"), "junk".getBytes)
      Files.write(dir.resolve("._resource-fork"), "junk".getBytes)

      val result = PreFlightCheck.scan(dir)
      result.fileCount must be(1)
      result.junkCount must be(2)
    }
  }

  test("scan counts junk files as uploads when includeJunk is set") {
    withTempDir { dir =>
      Files.write(dir.resolve("real.txt"), "content".getBytes)
      Files.write(dir.resolve(".DS_Store"), "junk".getBytes)

      val result = PreFlightCheck.scan(dir, includeJunk = true)
      result.fileCount must be(2)
      result.junkCount must be(0)
    }
  }

  test("formatSummary includes source and destination") {
    val result = PreFlightCheck.ScanResult(42, 1024 * 1024 * 10, 5, 0)
    val summary = PreFlightCheck.formatSummary(Path.of("/data/upload"), "myCollection/myIngestion", result)

    summary must include("/data/upload")
    summary must include("myCollection/myIngestion")
    summary must include("42")
    summary must include("5")
    summary must not include "Excluded"
  }

  test("formatSummary reports excluded junk files when present") {
    val result = PreFlightCheck.ScanResult(42, 1024, 5, 3)
    val summary = PreFlightCheck.formatSummary(Path.of("/data/upload"), "myCollection/myIngestion", result)

    summary must include("3 OS junk file(s)")
  }
}
