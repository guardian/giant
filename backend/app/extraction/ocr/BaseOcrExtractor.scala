package extraction.ocr

import extraction.{ExtractionParams, FileExtractor}
import model.manifest.Blob
import services.ScratchSpace
import utils.Ocr.{OcrMyPdfTimeout, OcrSubprocessInterruptedException}
import utils.OcrStderrLogger
import utils.attempt.{Failure, OcrTimeout, SubprocessInterruptedFailure}

import java.io.File
import scala.util.control.NonFatal

abstract class BaseOcrExtractor(scratchSpace: ScratchSpace) extends FileExtractor(scratchSpace) {
  def extractOcr(blob: Blob, file: File, params: ExtractionParams, stdErrLogger: OcrStderrLogger): Unit
  def buildStdErrLogger(blob: Blob): OcrStderrLogger

  final override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    if (params.languages.isEmpty) {
      throw new IllegalStateException(s"${this.name} requires a language")
    }

    val stdErrLogger = buildStdErrLogger(blob)

    try {
      extractOcr(blob, file, params, stdErrLogger)
      Right(())
    } catch {
      case OcrSubprocessInterruptedException =>
        Left(SubprocessInterruptedFailure)

      case e: OcrMyPdfTimeout =>
        println(s"${this.name} error - ${e.getMessage}")
        Left(OcrTimeout(s"${this.name} error - ${e.getMessage}"))

      case NonFatal(e) =>
        // Throw exception here instead of returning Left to include stderr and preserve the original stack trace
        throw new IllegalStateException(s"${this.name} error ${stdErrLogger.getOutput}", e)
    }
  }
}
