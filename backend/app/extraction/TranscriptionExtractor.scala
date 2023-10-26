package extraction

import cats.syntax.either._
import model.manifest.Blob
import model.{English, Languages}
import org.apache.commons.io.FileUtils
import services.ScratchSpace
import services.index.Index
import services.ingestion.IngestionServices
import utils.FfMpeg.FfMpegSubprocessCrashedException
import utils.attempt.{Failure, FfMpegFailure, UnknownFailure}
import utils._

import java.io.File
import scala.io.Source

class TranscriptionExtractor(index: Index, scratchSpace: ScratchSpace) extends FileExtractor(scratchSpace) with Logging {
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
  override def priority = 5

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    logger.info(s"Running transcription extractor '${blob.uri.value}'")

    val tmpDir = scratchSpace.createWorkingDir(s"whisper-tmp-${blob.uri.value}")
    val ffMpegTmpDir = scratchSpace.createWorkingDir(s"ffmpeg-tmp-${blob.uri.value}")

    val stdErrLogger = new BasicStdErrLogger()

    val result = Either.catchNonFatal{
      val convertedFile = FfMpeg.convertToWav(file.toPath, ffMpegTmpDir)
      val transcriptResult: TranscriptionResult = Whisper.invokeWhisper(convertedFile, tmpDir, translate =false)
      val translationResult = if (transcriptResult.language != "en") Some(Whisper.invokeWhisper(convertedFile, tmpDir, translate=true)) else None

      index.addDocumentTranscription(blob.uri, Some(transcriptResult.text), Languages.getByIso6391Code(transcriptResult.language).getOrElse(English))
      translationResult.map(tr => index.addDocumentTranscription(blob.uri, Some(tr.text), English))
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
