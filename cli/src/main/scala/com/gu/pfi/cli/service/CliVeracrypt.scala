package com.gu.pfi.cli.service

import java.nio.file.{Files, Path}

import utils.attempt.Attempt

import scala.concurrent.ExecutionContext
import scala.sys.process._
import scala.util.control.NonFatal

class CliVeracrypt(implicit ec: ExecutionContext) {
  private lazy val veracryptCommand = detectCommand()

  def mount(volume: Path, password: String, truecrypt: Boolean): Attempt[Path] = {
    val mountpoint = Files.createTempDirectory("pfi-veracrypt")

    val tcArgs = if(truecrypt) { Seq("--truecrypt") } else { Seq.empty }
    val args = Seq("--mount-options=ro", s"--password=$password", volume.toAbsolutePath.toString, mountpoint.toAbsolutePath.toString)

    Attempt.catchNonFatalBlasé {
      command(tcArgs ++ args).!!
      mountpoint
    }
  }

  def dismount(volume: Path, mountpoint: Path): Attempt[Unit] = {
    val args = Seq("--dismount", volume.toAbsolutePath.toString)

    Attempt.catchNonFatalBlasé {
      command(args).!!
    }.map { _ =>
      Files.delete(mountpoint)
    }
  }

  private def command(args: Seq[String]): ProcessBuilder = {
    Process(veracryptCommand, Seq("--text", "--non-interactive") ++ args)
  }

  private def detectCommand(): String = {
    try {
      val osxCommand = "/Applications/VeraCrypt.app/Contents/MacOS/VeraCrypt"
      s"$osxCommand --text --non-interactive --version".!!

      osxCommand
    } catch {
      case NonFatal(_) =>
        "veracrypt"
    }
  }
}
