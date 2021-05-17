package model.ingestion

import java.nio.file.Path

import model.{Language, Uri}

case class OnDiskFileContext(file: IngestionFile, parents: List[Uri], ingestion: String, languages: List[Language], path: Path) {
  def isRegularFile: Boolean = file.isRegularFile
  def size: Long = file.size
}
