package utils

import java.nio.file.{Files, Path}
import services.TesseractOcrConfig
import utils.attempt.Failure

import scala.collection.mutable
import scala.sys.process._

class OcrStderrLogger(setProgressNote: Option[String => Either[Failure, Unit]]) extends Logging {
  val LOG_THROTTLE_RATE_MILLIS = 5000

  val acc = mutable.Buffer[String]()
  var lastLogTime: Option[Long] = None

  def append(line: String): Unit = {
    acc.append(line)

    logger.info(line)

    // Avoid spamming the database should the extractor output a lot of stderr logging quickly
    val now = System.currentTimeMillis()
    if(lastLogTime.isEmpty || lastLogTime.exists(t => (now - t) > LOG_THROTTLE_RATE_MILLIS)) {
      setProgressNote.foreach(f => f(line))
      lastLogTime = Some(now)
    }
  }

  def getOutput: String = {
    acc.mkString("\n")
  }
}

object Ocr {
  class OcrSubprocessCrashedException(exitCode: Int, stderr: String) extends Exception(s"Exit code: $exitCode: ${stderr}")
  object OcrSubprocessInterruptedException extends Exception("Ocr subprocess terminated externally")

  // from https://github.com/jbarlow83/OCRmyPDF/blob/4b8ccbe8cb76480b03ab42b0c61814acd1c59a60/docs/advanced.rst#return-code-policy
  object OcrMyPdfBadArgs extends Exception("Invalid arguments, exited with an error.")
  object OcrMyPdfInputFile extends Exception("The input file does not seem to be a valid PDF.")
  object OcrMyPdfMissingDependency extends Exception("An external program required by OCRmyPDF is missing.")
  object OcrMyPdfInvalidOutputPdf extends Exception("An output file was created, but it does not seem to be a valid PDF. The file will be available.")
  object OcrMyPdfFileAccessError extends Exception("The user running OCRmyPDF does not have sufficient permissions to read the input file and write the output file.")
  object OcrMyPdfAlreadyDoneOcr extends Exception("The file already appears to contain text so it may not need OCR. See output message.")
  object OcrMyPdfChildProcessError extends Exception("An error occurred in an external program (child process) and OCRmyPDF cannot continue.")
  object OcrMyPdfEncryptedPdf extends Exception("The input PDF is encrypted. OCRmyPDF does not read encrypted PDFs. Use another program such as qpdf to remove encryption.")
  object OcrMyPdfInvalidConfig extends Exception("A custom configuration file was forwarded to Tesseract using --tesseract-config, and Tesseract rejected this file.")
  object OcrMyPdfPdfaConversionFailed extends Exception("A valid PDF was created, PDF/A conversion failed. The file will be available.")
  object OcrMyPdfOtherError extends Exception("Some other error occurred.")
  object OcrMyPdfCtrlC extends Exception("The program was interrupted by pressing Ctrl+C.")

  def invokeTesseractDirectly(lang: String, imageFileName: String, config: TesseractOcrConfig, stderr: OcrStderrLogger): String = {
    val cmd = s"tesseract $imageFileName stdout -l $lang --oem ${config.engineMode} --psm ${config.pageSegmentationMode}"

    val stdout = mutable.Buffer.empty[String]
    val exitCode = Process(cmd).!(ProcessLogger(stdout.append(_), stderr.append))

    exitCode match {
      case 143 =>
        // The worker was terminated midway through. Don't register this as a failure to allow another worker to pick it up
        throw OcrSubprocessInterruptedException

      case 0 =>
        stdout.mkString("\n")

      case _ =>
        throw new OcrSubprocessCrashedException(exitCode, stderr.getOutput)
    }
  }

  // TODO MRB: allow OcrMyPdf to read DPI if set in metadata
  // OCRmyPDF is a wrapper for Tesseract that we use to overlay the OCR as a text layer in the resulting PDF
  def invokeOcrMyPdf(lang: String, inputFileName: String, dpi: Option[Int], stderr: OcrStderrLogger, tmpDir: Path): Path = {
    val tempFile = Files.createTempFile("ocrmypdf", ".pdf")
    val cmd = s"ocrmypdf --redo-ocr -l $lang ${dpi.map(dpi => s"--image-dpi $dpi").getOrElse("")} ${inputFileName} ${tempFile.toAbsolutePath}"

    val stdout = mutable.Buffer.empty[String]
    val process = Process(cmd, cwd = None, extraEnv = "TMPDIR" -> tmpDir.toAbsolutePath.toString)
    val exitCode = process.!(ProcessLogger(stdout.append(_), stderr.append))

    exitCode match {
      // 0: success
      // 4: "An output file was created, but it does not seem to be a valid PDF. The file will be available."
      // 10: "A valid PDF was created, PDF/A conversion failed. The file will be available."
      // These both produce an output file (they're more like warnings than failures)
      // so we want to return the file instead of throwing an exception.
      case 0 | 4 | 10 => tempFile
      case 1 => throw OcrMyPdfBadArgs
      case 2 => throw OcrMyPdfInputFile
      case 3 => throw OcrMyPdfMissingDependency
      case 5 => throw OcrMyPdfFileAccessError
      case 6 => throw OcrMyPdfAlreadyDoneOcr
      case 7 => throw OcrMyPdfChildProcessError
      case 8 => throw OcrMyPdfEncryptedPdf
      case 9 => throw OcrMyPdfInvalidConfig
      case 15 => throw OcrMyPdfOtherError
      case 130 => throw OcrMyPdfCtrlC
      // This default case will cover code 143 where worker was terminated midway through.
      // Don't register this as a failure to allow another worker to pick it up
      case _ => throw OcrSubprocessInterruptedException
    }
  }
}
