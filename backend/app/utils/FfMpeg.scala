package utils

import java.nio.file.Path
import scala.collection.mutable
import scala.sys.process.{Process, ProcessLogger, stdout}

class FfMpegStdErrLogger() extends Logging {

  val acc = mutable.Buffer[String]()

  def append(line: String): Unit = {
    acc.append(line)

    logger.info(line)

  }

  def getOutput: String = {
    acc.mkString("\n")
  }
}

object FfMpeg extends Logging {

  case class FfMpegSubprocessCrashedException(exitCode: Int, stderr: String) extends Exception(s"Exit code: $exitCode: ${stderr}")

  def convertToWav(originalFile: Path, tmpDir: Path): Path = {
    val ffMpegStdErrLogger = new FfMpegStdErrLogger()
    println(s"Running ffmpeg ''")
    val tempFile = tmpDir.resolve(s"${originalFile.getFileName}.wav")
    val cmd = s"ffmpeg -i ${originalFile} -ar 16000 -ac 1 -c:a pcm_s16le ${tempFile}"
    println(s"cmd: ${cmd}")
    val exitCode = Process(cmd, cwd = None).!(ProcessLogger(stdout.append(_), ffMpegStdErrLogger.append))

    exitCode match {
      case 0 =>
        tempFile
      case _ =>
        logger.error("FfMpeg conversion failed")
        throw FfMpegSubprocessCrashedException(exitCode, ffMpegStdErrLogger.getOutput)
    }
  }
}