package com.gu.pfi.cli.ingestion

import java.nio.file.{Files, Path}
import model.{Language, Uri}
import model.ingestion.{IngestionFile, OnDiskFileContext}
import utils.Logging

import scala.jdk.StreamConverters._
import scala.util.Try

class CliFileWalker(enrich: Path => IngestionFile) extends Logging {
  def walk(path: Path, root: Uri, languages: List[Language]): LazyList[OnDiskFileContext] = {
    walk(path, List(root.chain(path.getFileName.toString), root), root, languages)
  }

  private def walk(thisPath: Path, parents: List[Uri], root: Uri, languages: List[Language]): LazyList[OnDiskFileContext] = {
    val enrichedPath = enrich(thisPath)

    OnDiskFileContext(enrichedPath, parents, root.value, languages, thisPath) #:: {
      if (Files.isDirectory(thisPath)) {
        Try {
          val fileStream = Files.list(thisPath)
          // eagerly evaluate the file stream; allowing it to be closed to avoid resource exhaustion
          val evaluated = LazyList.from(fileStream.toScala(List))
          fileStream.close()
          evaluated
        }.map(_.flatMap(p => walk(p, parents.head.chain(p.getFileName.toString) :: parents, root, languages))).getOrElse {
          logger.error(s"IO error reading '$thisPath'")
          LazyList.empty[OnDiskFileContext]
        }
      } else {
        LazyList.empty[OnDiskFileContext]
      }
    }
  }
}

