package com.gu.pfi.cli.ingestion

import java.nio.file.{Path, Paths}

import com.gu.pfi.cli.{IngestionType, Options}

sealed trait IngestionSource
case class FilesystemSource(root: Path) extends IngestionSource
case class EncryptedVolumeSource(volume: Path, password: String, truecrypt: Boolean) extends IngestionSource

object IngestionSource {
  import scala.language.reflectiveCalls

  def apply(options: Options): IngestionSource = {
    val path = Paths.get(options.ingestCmd.path())

    options.ingestCmd.ingestionType.toOption match {
      case None | Some(IngestionType.FileSystem) =>
        FilesystemSource(path)

      case Some(ingestionType) =>
        EncryptedVolumeSource(path, options.ingestCmd.password(), ingestionType == IngestionType.Truecrypt)
    }
  }
}
