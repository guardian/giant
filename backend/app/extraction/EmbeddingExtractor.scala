package extraction

import cats.syntax.either._
import model.manifest.Blob
import model.{English, Languages}
import org.apache.commons.io.FileUtils
import services.index.{Index, Pages}
import services.{ScratchSpace, TranscribeConfig}
import utils.FfMpeg.FfMpegSubprocessCrashedException
import utils._
import utils.attempt.{Failure, FfMpegFailure, UnknownFailure}

import java.io.File
import scala.concurrent.ExecutionContext

class EmbeddingExtractor(index: Index, pages: Pages, scratchSpace: ScratchSpace, transcribeConfig: TranscribeConfig)(implicit executionContext: ExecutionContext) extends FileExtractor(scratchSpace) with Logging {
  val mimeTypes: Set[String] = Set(
    "application/pdf"
  )

  def canProcessMimeType: String => Boolean = mimeTypes.contains

  override def indexing = true
  // set a low priority as transcription takes a long time, we don't want to block up the workers
  override def priority = 1

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    logger.info(s"Running embedding extractor '${blob.uri.value}'")

    // Get the pages from elasticsearch
    for {
      page <- pages.getAllPages(blob.uri)
    } yield {
      // Run page through embedding model
      // Write embeddings to a vector field against the page
    }

    Right(())
  }
}
