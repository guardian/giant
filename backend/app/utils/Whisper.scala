package utils

import java.nio.file.Path
import scala.collection.mutable
import scala.sys.process._

case class TranscriptionResult(path: Path, language: String)
class WhisperStdErrLogger() extends Logging {

  val acc = mutable.Buffer[String]()

  def append(line: String): Unit = {
    acc.append(line)

    logger.info(line)

  }

  def getOutput: String = {
    acc.mkString("\n")
  }
}
object Whisper extends Logging {
  private class WhisperSubprocessCrashedException(exitCode: Int, stderr: String) extends Exception(s"Exit code: $exitCode: ${stderr}")


  def invokeWhisper(audioFilePath: Path, tmpDir: Path, translate: Boolean): TranscriptionResult = {
    val whisperLogger = new WhisperStdErrLogger()
    val tempFile = tmpDir.resolve(s"${audioFilePath.getFileName}")

    val translateParam = if(translate) "--translate" else ""
    val cmd = s"sh backend/app/utils/whisper.sh -f ${audioFilePath.toString} --output-txt --output-file ${tempFile.toString} -l auto ${translateParam}"
    val exitCode = Process(cmd, cwd = None).!(ProcessLogger(stdout.append(_), whisperLogger.append))

    exitCode match {
      case 0 =>
        val detectedLanguage = whisperLogger.getOutput.split("auto-detected language: ")(1).slice(0,2).mkString("")
        println(s"ah ${whisperLogger.getOutput}")
        //for some reason whisper adds an extra .txt extension
        TranscriptionResult(tempFile.resolveSibling(tempFile.getFileName.toString + ".txt"), detectedLanguage)
      case _ =>
        logger.error("Whisper extraction failed")
        throw new WhisperSubprocessCrashedException(exitCode, whisperLogger.getOutput)
    }
  }

}
