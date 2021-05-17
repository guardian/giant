package com.gu.pfi.cli.service

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path}

import utils.attempt.Attempt

object CliFiles {
  def writeFile(file: Path, contents: String): Attempt[Unit] = Attempt.catchNonFatalBlasé {
    Files.write(file, contents.getBytes(StandardCharsets.UTF_8))
  }

  def readFile(file: Path): Attempt[String] = Attempt.catchNonFatalBlasé {
    new String(Files.readAllBytes(file), StandardCharsets.UTF_8)
  }
}
