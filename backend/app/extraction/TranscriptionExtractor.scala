package extraction

import model.English
import model.manifest.Blob
import org.apache.commons.io.FileUtils
import services.{ScratchSpace, Tika}
import services.index.Index
import services.ingestion.IngestionServices
import utils.{Logging, OcrStderrLogger, Whisper}
import utils.attempt.AttemptAwait._
import utils.attempt.{Failure, UnknownFailure, UnsupportedOperationFailure}
import cats.syntax.either._

import java.io.{File, InputStream}
import scala.concurrent.ExecutionContext
import scala.io.Source
import scala.reflect.runtime.universe.Try
import scala.util.control.NonFatal

class TranscriptionExtractor(index: Index, scratchSpace: ScratchSpace, ingestionServices: IngestionServices) extends FileExtractor(scratchSpace) with Logging {
  val mimeTypes: Set[String] = Set(
    "audio/wav",
    "audio/vnd.wave",
  )

  def canProcessMimeType: String => Boolean = mimeTypes.contains

  override def indexing = true
  override def priority = 5

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    logger.info(s"Running transcription extractor '${blob.uri.value}'")

    val tmpDir = scratchSpace.createWorkingDir(s"whisper-tmp-${blob.uri.value}")

    val stdErrLogger = new OcrStderrLogger(Some(ingestionServices.setProgressNote(blob.uri, this, _)))

    val transcriptionLanguage = if (params.languages.length > 1) {
      logger.warn("More than one language specified. Sorry, just using english but if you write some code we can make whisper auto detect the language in the file")
      English
    } else params.languages.headOption.getOrElse(English)

    val result = Either.catchNonFatal{
      val outputFile = Whisper.invokeWhisper(file.toPath, stdErrLogger, tmpDir, transcriptionLanguage.key)
      val outputSource = Source.fromFile(outputFile.toFile)
      val outputText = outputSource.getLines().toList.mkString("\n")
      outputSource.close()

      logger.info(outputText)
      index.addDocumentTranscription(blob.uri, Some(outputText), transcriptionLanguage)
      ()
    }.leftMap{ error =>
      logger.error(s"${this.name} error ${stdErrLogger.getOutput}", error)
      UnknownFailure.apply(error)
    }
    FileUtils.deleteDirectory(tmpDir.toFile)

    result



    // create temp dir
    // sort out languages
    // run whisper on blob
    // pick most human readable version
    // convert to PDF?
    // make sure pdf gets pageviewerified

  }


}
