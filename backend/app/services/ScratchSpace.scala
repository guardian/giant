package services

import java.io.{File, InputStream}
import java.nio.file.{Files, Path, Paths, StandardCopyOption}
import java.util.UUID
import model.ingestion.Key
import model.manifest.Blob
import utils.Logging
import utils.attempt.Attempt

import scala.util.control.NonFatal

class ScratchSpace(rootFolder: Path) extends Logging {
  def setup(): Attempt[Unit] = Attempt.Right {
    ensureRootFolderExists()
  }

  def ensureRootFolderExists(): Unit = {
    try {
      Files.createDirectories(rootFolder)
    } catch {
      case NonFatal(t) =>
        logger.error(s"Haven't managed to create the scratch space root at $rootFolder", t)
        throw t
    }
  }

  def pathFor(key: Key) = rootFolder.resolve(s"${key._1}-${key._2}.data")
  def pathFor(key: String) = rootFolder.resolve(key)

  def createWorkingDir(name: String): Path = {
    ensureRootFolderExists()
    Files.createDirectories(rootFolder.resolve(name))
  }

  def copyToScratchSpace(blob: Blob, stream: InputStream): File = {
    copyToScratchSpace(Paths.get(blob.uri.value), stream)
  }

  def copyToScratchSpace(path: Path, stream: InputStream): File = {
    ensureRootFolderExists()

    val scratchPath = rootFolder.resolve(path)

    logger.info(s"Copying ${path.toString} to scratch pad location $scratchPath")
    Files.copy(stream, scratchPath, StandardCopyOption.REPLACE_EXISTING)

    scratchPath.toFile
  }

  def copyToScratchSpace(stream: InputStream): File = {
    val scratchPath = rootFolder.resolve(s"${UUID.randomUUID().toString}.entry.tmp")
    copyToScratchSpace(scratchPath, stream)
  }
}
