package utils

import java.nio.file.Path
import scala.io.Source
import scala.sys.process._

case class TranscriptionResult(text: String, language: String)

object Whisper extends Logging {
  private class WhisperSubprocessCrashedException(exitCode: Int, stderr: String) extends Exception(s"Exit code: $exitCode: ${stderr}")


  def getTranscriptOutputText(outputFile: Path) = {
    //for some reason whisper adds an extra .txt extension
    val outputLocation = outputFile.resolveSibling(outputFile.getFileName.toString + ".txt")
    val outputSource = Source.fromFile(outputLocation.toFile)
    val outputText = outputSource.getLines().toList.mkString("\n")
    outputSource.close()
    outputText
  }


  def invokeWhisper(audioFilePath: Path, tmpDir: Path, whisperLogger: BasicStdErrLogger, translate: Boolean): TranscriptionResult = {
    val tempFile = tmpDir.resolve(s"${audioFilePath.getFileName}")

    val translateParam = if(translate) "--translate" else ""
    val cmd = s"/opt/whisper/whisper.cpp/main -m /opt/whisper/whisper.cpp/models/ggml-large.bin -f ${audioFilePath.toString} --output-txt --output-file ${tempFile.toString} -l auto ${translateParam}"
    val exitCode = Process(cmd, cwd = None).!(ProcessLogger(stdout.append(_), whisperLogger.append))

    exitCode match {
      case 0 =>
        val transcriptText = getTranscriptOutputText(tempFile)
        val languageSplit = whisperLogger.getOutput.split("auto-detected language: ")
        if (languageSplit.length > 1) {
          val detectedLanguage = if (translate) "en" else languageSplit(1).slice(0,2).mkString("")
          TranscriptionResult(transcriptText, detectedLanguage)
        } else {
          logger.warn("Failed to detect language - transcription may have failed. Falling back to english.")
          TranscriptionResult(transcriptText, "en")
        }
      case _ =>
        logger.error("Whisper extraction failed")
        throw new WhisperSubprocessCrashedException(exitCode, whisperLogger.getOutput)
    }
  }

}
