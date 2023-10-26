package utils

import java.nio.file.Path
import scala.sys.process.{Process, ProcessLogger, stdout}

object FfMpeg extends Logging {

  case class FfMpegSubprocessCrashedException(exitCode: Int, stderr: String) extends Exception(s"Exit code: $exitCode: ${stderr}")

  def convertToWav(originalFile: Path, tmpDir: Path): Path = {
    val ffMpegStdErrLogger = new BasicStdErrLogger()
    val tempFile = tmpDir.resolve(s"${originalFile.getFileName}.wav")
    val cmd = s"ffmpeg -i $originalFile -ar 16000 -ac 1 -c:a pcm_s16le ${tempFile}"
    val exitCode = Process(cmd, cwd = None).!(ProcessLogger(stdout.append(_), ffMpegStdErrLogger.append))

    exitCode match {
      case 0 =>
        tempFile
      case _ =>
        logger.error("FfMpeg conversion in transcription extraction failed")
        throw FfMpegSubprocessCrashedException(exitCode, ffMpegStdErrLogger.getOutput)
    }
  }
}