package utils

import model.Language
import utils.attempt.Failure

import java.nio.file.Path
import scala.collection.mutable
import scala.sys.process._

object Whisper extends Logging {
  private class WhisperSubprocessCrashedException(exitCode: Int, stderr: String) extends Exception(s"Exit code: $exitCode: ${stderr}")


  def invokeWhisper(audioFilePath: Path,  stderr: OcrStderrLogger, tmpDir: Path, language: String): Path = {
    val tempFile = tmpDir.resolve(s"${audioFilePath.getFileName}.txt")

    val whisperDir = "/Users/philip_mcmahon/code/whisper.cpp"
    val cmd = s"$whisperDir/main -m $whisperDir/models/ggml-large.bin -f ${audioFilePath.toString} --output-txt --output-file ${tempFile.toString} -l $language"

    val exitCode = Process(cmd, cwd = None).!(ProcessLogger(stdout.append(_), stderr.append))

    exitCode match {
      case 0 =>
        //for some reason whisper adds an extra .txt extension
        tempFile.resolveSibling(tempFile.getFileName.toString + ".txt")
      case _ =>
        logger.error("Whisper extraction failed")
        throw new WhisperSubprocessCrashedException(exitCode, stderr.getOutput)
    }
  }

}
