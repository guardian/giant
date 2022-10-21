package extraction.archives

import java.io.File
import java.nio.file.attribute.FileTime
import java.nio.file.{Files, Path, Paths}

import cats.syntax.either._
import extraction.{ExtractionParams, FileExtractor}
import ingestion.IngestionContextBuilder
import model.Uri
import model.ingestion.FileContext
import model.manifest.Blob
import org.apache.commons.compress.archivers.zip.{ZipArchiveEntry, ZipFile}
import org.apache.commons.io.FileUtils
import services.ingestion.IngestionServices
import services.{FingerprintServices, ScratchSpace}
import utils.Logging
import utils.attempt.{Failure, UnknownFailure}

import scala.jdk.CollectionConverters._

class ZipExtractor(scratch: ScratchSpace, ingestionServices: IngestionServices) extends FileExtractor(scratch) with Logging {
  val mimeTypes = Set(
    "application/zip"
  )
  override def canProcessMimeType = mimeTypes.contains

  override def indexing = false
  override def priority = 6

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    val extractionRootPath = scratch.createWorkingDir(s"zip/${blob.uri.value}/")
    logger.info(s"Running ZIP extractor on '${blob.uri.value}' in temporary working directory '$extractionRootPath'")

    val zipFile = new ZipFile(file)
    val builder = IngestionContextBuilder(blob.uri, params)

    val result = Either.catchNonFatal {
      zipFile.getEntries.asScala.foreach { entry =>
        if (!entry.isDirectory) {
          var scratchFile: Option[Path] = None

          try {
            val content = zipFile.getInputStream(entry)
            scratchFile = Some(scratch.copyToScratchSpace(content).toPath)

            val blobUri = Uri(FingerprintServices.createFingerprintFromFile(scratchFile.get.toFile))
            val context = getContext(entry, scratchFile.get, builder)

            ingestionServices.ingestFile(context, blobUri, scratchFile.get)
          } finally {
            scratchFile.foreach(Files.deleteIfExists)
          }
        }
      }
    }.leftMap(UnknownFailure.apply)

    zipFile.close()
    FileUtils.deleteDirectory(extractionRootPath.toFile)

    result
  }

  def getContext(entry: ZipArchiveEntry, fileOnDisk: Path, context: IngestionContextBuilder): FileContext = {
    // Handle NUL characters at the end of the the entry name (which break the Java Paths API)
    val entryName = entry.getName.trim()
    val entryPath = Paths.get(entryName)

    context.pushParentDirectories(entryPath).finish(
      fileName = entryPath.getFileName.toString,
      fileOnDisk = fileOnDisk,
      creationTime = None,
      lastAccessTime = None,
      lastModifiedTime = Option(entry.getTime).filter(_ != -1).map(FileTime.fromMillis)
    )
  }
}
