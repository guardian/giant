package extraction.archives

import java.io.File

import com.github.junrar.Junrar
import com.google.common.io.Files
import extraction.{ExtractionParams, FileExtractor}
import ingestion.IngestionContextBuilder
import model.Uri
import model.manifest.Blob
import org.apache.commons.io.FileUtils
import services.ingestion.IngestionServices
import services.{FingerprintServices, ScratchSpace}
import utils.Logging
import utils.attempt.Failure

import scala.collection.JavaConverters._

// Does not support RAR 5
class RarExtractor(scratch: ScratchSpace, ingestionServices: IngestionServices) extends FileExtractor(scratch) with Logging {
  override def canProcessMimeType = Set("application/x-rar-compressed").contains
  override def indexing = false
  override def priority = 6

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    val extractionRootPath = scratch.createWorkingDir(s"rar/${blob.uri.value}/").toAbsolutePath
    logger.info(s"Running RAR extractor on '${blob.uri.value}' in temporary working directory '$extractionRootPath'")

    try {
      val context = IngestionContextBuilder(blob.uri, params)
      Junrar.extract(file, extractionRootPath.toFile)

      val files = Files.fileTraverser().depthFirstPreOrder(extractionRootPath.toFile).iterator().asScala
      files.foreach { entry =>
        if(entry.isFile) {
          val entryPath = extractionRootPath.relativize(entry.toPath.toAbsolutePath)
          val entryContext = context.pushParentDirectories(entryPath).finishWithFile(entry.toPath)

          val blobUri = Uri(FingerprintServices.createFingerprintFromFile(entry))
          ingestionServices.ingestFile(entryContext, blobUri, entry.toPath)
        }
      }

      Right(())
    } finally {
      FileUtils.deleteDirectory(extractionRootPath.toFile)
    }
  }
}
