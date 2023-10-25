package extraction

import model.{English, Language, Languages}
import model.manifest.Blob
import org.apache.commons.io.FileUtils
import services.{ScratchSpace, Tika}
import services.index.Index
import services.ingestion.IngestionServices
import utils.{FfMpeg, Logging, OcrStderrLogger, TranscriptionResult, Whisper}
import utils.attempt.AttemptAwait._
import utils.attempt.{Failure, UnknownFailure, ffMpegFailure}
import cats.syntax.either._
import utils.FfMpeg.FfMpegSubprocessCrashedException

import java.io.{File, InputStream}
import scala.concurrent.ExecutionContext
import scala.io.Source
import scala.reflect.runtime.universe.Try
import scala.util.control.NonFatal

class TranscriptionExtractor(index: Index, scratchSpace: ScratchSpace, ingestionServices: IngestionServices) extends FileExtractor(scratchSpace) with Logging {
  val mimeTypes: Set[String] = Set(
    "audio/wav",
    "audio/vnd.wave",
    "audio/x-aiff"
  )

  def canProcessMimeType: String => Boolean = mimeTypes.contains

  override def indexing = true
  override def priority = 5

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    logger.info(s"Running transcription extractor '${blob.uri.value}'")

    val tmpDir = scratchSpace.createWorkingDir(s"whisper-tmp-${blob.uri.value}")
    val ffMpegTmpDir = scratchSpace.createWorkingDir(s"ffmpeg-tmp-${blob.uri.value}")

    val stdErrLogger = new OcrStderrLogger(Some(ingestionServices.setProgressNote(blob.uri, this, _)))

    val transcriptionLanguage = if (params.languages.length > 1) {
      logger.warn("More than one language specified. Will tell whisper to autodetect and translate")
      None
    } else params.languages.headOption

    println(params.languages)

    val result = Either.catchNonFatal{
      val convertedFile = FfMpeg.convertToWav(file.toPath, ffMpegTmpDir)
      val transcriptResult: TranscriptionResult = Whisper.invokeWhisper(convertedFile, tmpDir, translate =false)
      val translationResult = if (transcriptResult.language != "en") Some(Whisper.invokeWhisper(file.toPath, tmpDir, translate=true)) else None
      val outputSource = Source.fromFile(transcriptResult.path.toFile)
      val outputText = outputSource.getLines().toList.mkString("\n")
      outputSource.close()

      val translateText = translationResult.map(tr => Source.fromFile(tr.path.toFile).getLines().toList.mkString("\n"))

      println(translateText)
      logger.info(outputText)
      index.addDocumentTranscription(blob.uri, Some(outputText), Languages.getByIso6391Code(transcriptResult.language).getOrElse(English))
      ()
    }.leftMap{
      case e: FfMpegSubprocessCrashedException =>
        ffMpegFailure(s"ffMpeg failure with exit code ${e.exitCode}")
      case error =>
        logger.error (s"${this.name} error ${stdErrLogger.getOutput}", error)
        UnknownFailure.apply (error)
    }
    FileUtils.deleteDirectory(tmpDir.toFile)
    FileUtils.deleteDirectory(ffMpegTmpDir.toFile)

    result

    // create temp dir
    // sort out languages
    // run whisper on blob
    // pick most human readable version
    // convert to PDF?
    // make sure pdf gets pageviewerified

  }
}
