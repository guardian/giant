package extraction

import cats.syntax.either._
import model.manifest.Blob
import model.{English, Languages}
import org.apache.commons.io.FileUtils
import services.{ScratchSpace, TranscribeConfig}
import services.index.Index
import utils.FfMpeg.FfMpegSubprocessCrashedException
import utils.attempt.{Failure, FfMpegFailure, UnknownFailure}
import utils._

import scala.concurrent.ExecutionContext
import java.io.File

class TranscriptionExtractor(index: Index, scratchSpace: ScratchSpace, transcribeConfig: TranscribeConfig)(implicit executionContext: ExecutionContext) extends FileExtractor(scratchSpace) with Logging {
  val mimeTypes: Set[String] = Set(
    "audio/wav",
    "audio/vnd.wave",
    "audio/x-aiff", // converted and transcribed. But preview doesn't work
    "audio/mpeg",
    "audio/aac", // tika can't detect this!!
    "audio/vorbis", // Converted by ffmpeg but failed in whisper
    "audio/opus",
    "audio/amr", // converted and transcribed. But preview doesn't work
    "audio/amr-wb", // Couldn't find a sample to test
    "audio/x-caf", // Couldn't find a sample to test
    "audio/mp4", // Couldn't find a sample to test
    "audio/x-ms-wma", // converted and transcribed. But preview doesn't work
    "video/3gpp",
    "video/mp4", // quicktime detected for some of mp4 samples
    "video/quicktime",
    "video/x-flv", // converted and transcribed. But preview doesn't work
    "video/x-ms-wmv", // converted and transcribed. But preview doesn't work
    "video/x-msvideo", // converted and transcribed. But preview doesn't work
    "video/x-m4v",
    "video/mpeg" // converted and transcribed. But preview doesn't work
  )

  def canProcessMimeType: String => Boolean = mimeTypes.contains

  override def indexing = true
  // set a low priority as transcription takes a long time, we don't want to block up the workers
  override def priority = 1

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    logger.info(s"Running transcription extractor '${blob.uri.value}'")

    val tmpDir = scratchSpace.createWorkingDir(s"whisper-tmp-${blob.uri.value}")
    val ffMpegTmpDir = scratchSpace.createWorkingDir(s"ffmpeg-tmp-${blob.uri.value}")

    val stdErrLogger = new BasicStdErrLogger()

    val result = Either.catchNonFatal{
      val convertedFile = FfMpeg.convertToWav(file.toPath, ffMpegTmpDir)
      val transcriptResult: WhisperResult = Whisper.invokeWhisper(convertedFile, transcribeConfig, tmpDir, stdErrLogger, translate = false)
      val translationResult = if (transcriptResult.language != "en") Some(Whisper.invokeWhisper(convertedFile, transcribeConfig, tmpDir, stdErrLogger, translate = true)) else None

      val transcription = TranscriptionResult(Transcripts("", transcriptResult.text, ""), translationResult.map(r => Transcripts("", r.text, "")), TranscriptionMetadata(Languages.getByIso6391Code(transcriptResult.language).getOrElse(English)))

      index.addDocumentTranscription(blob.uri, transcription).recoverWith {
        case _ =>
          val msg = s"Failed to write transcript result to elasticsearch. Transcript language: ${transcriptResult.language}"
          logger.error(msg)
          // throw the error - will be caught by catchNonFatal
          throw new Error(msg)
      }
      ()
    }.leftMap{
      case error: FfMpegSubprocessCrashedException =>
        logger.error (s"${this.name} error ${stdErrLogger.getOutput}", error)
        FfMpegFailure(error, s"FfMpegFailure - exit code ${error.exitCode}")
      case error =>
        logger.error (s"${this.name} error ${stdErrLogger.getOutput}", error)
        UnknownFailure.apply (error)
    }
    FileUtils.deleteDirectory(tmpDir.toFile)
    FileUtils.deleteDirectory(ffMpegTmpDir.toFile)

    result
  }
}
