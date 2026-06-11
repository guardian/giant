package extraction.ocr

import extraction.{ExtractionParams, FileExtractor}
import model.Languages
import model.manifest.Blob
import org.apache.tika.language.detect.LanguageDetector
import services.ScratchSpace
import services.index.Index
import utils.Ocr.{OcrMyPdfTimeout, OcrSubprocessInterruptedException}
import utils.OcrStderrLogger
import utils.attempt.{Failure, OcrTimeout, SubprocessInterruptedFailure}

import java.io.File
import scala.concurrent.duration.DurationInt
import scala.concurrent.{Await, ExecutionContext}
import scala.util.control.NonFatal

abstract class BaseOcrExtractor(scratchSpace: ScratchSpace, index:Index)  (implicit ec: ExecutionContext)  extends FileExtractor(scratchSpace) {
  def extractOcr(blob: Blob, file: File, params: ExtractionParams, stdErrLogger: OcrStderrLogger): Unit
  def buildStdErrLogger(blob: Blob): OcrStderrLogger

  final override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    // extractors are synchronous so we have to await here
    val detectedLanguageCode = Await.result(index.getTextDetectedLanguage(blob.uri).asFuture, 3.seconds).toOption

    if (params.languages.isEmpty && detectedLanguageCode.isDefined) {
      throw new IllegalStateException(s"${this.name} requires a language")
    }

    // if we have detected a supported language code, use that, otherwise OCR in every language set for the ingestion
    val ocrLanguages = detectedLanguageCode.map(code => Languages.getByIso6391Code(code).toList).getOrElse(params.languages)

    val updatedParams = params.copy(languages = ocrLanguages)

    val stdErrLogger = buildStdErrLogger(blob)

    try {
      extractOcr(blob, file, updatedParams, stdErrLogger)
      Right(())
    } catch {
      case OcrSubprocessInterruptedException =>
        Left(SubprocessInterruptedFailure)

      case e: OcrMyPdfTimeout =>
        Left(OcrTimeout(s"${this.name} error - ${e.getMessage}"))

      case NonFatal(e) =>
        // Throw exception here instead of returning Left to include stderr and preserve the original stack trace
        throw new IllegalStateException(s"${this.name} error ${stdErrLogger.getOutput}", e)
    }
  }
}
