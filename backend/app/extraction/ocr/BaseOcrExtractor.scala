package extraction.ocr

import extraction.{ExternalOcrTranslationExtractor, ExtractionParams, FileExtractor}
import model.{Language, Languages, Uri}
import model.manifest.Blob
import org.apache.tika.language.detect.LanguageDetector
import services.ScratchSpace
import services.index.Index
import services.ingestion.{IngestionServices, LanguageDetect}
import services.ingestion.IngestionServices.{detectLanguageChunked, isNotEnglish}
import utils.Logging
import utils.Ocr.{OcrMyPdfTimeout, OcrSubprocessInterruptedException}
import utils.OcrStderrLogger
import utils.attempt.AttemptAwait._
import utils.attempt.{Failure, OcrTimeout, SubprocessInterruptedFailure}

import java.io.File
import scala.concurrent.duration.DurationInt
import scala.concurrent.{Await, ExecutionContext}
import scala.util.control.NonFatal


abstract class BaseOcrExtractor(scratchSpace: ScratchSpace, index:Index)  (implicit ec: ExecutionContext)  extends FileExtractor(scratchSpace) with Logging {
  def extractOcr(blob: Blob, file: File, params: ExtractionParams, stdErrLogger: OcrStderrLogger): Unit
  def buildStdErrLogger(blob: Blob): OcrStderrLogger

  final override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    // extractors are synchronous so we have to await here
    val detectedLanguageCode = Await.result(index.getTextDetectedLanguage(blob.uri).asFuture, 3.seconds).toOption

    // if we have detected a *supported* language code, use that, otherwise OCR in every language set for the ingestion.
    // see Languages.scala for a list of supported languages
    val detectedLanguage = detectedLanguageCode.flatMap { code =>
      val lang = Languages.getByIso6391Code(code)
      if (lang.isEmpty) {
        logger.info(s"${this.name}: detected language '$code' for ${blob.uri.value} is not supported, falling back to ingestion languages")
      }
      lang
    }

    val ocrLanguages = detectedLanguage.map(List(_)).getOrElse(params.languages)

    if (ocrLanguages.isEmpty) {
      throw new IllegalStateException(s"${this.name} requires at least one language (blob ${blob.uri.value}, ingestion ${params.ingestion}, detected language ${detectedLanguageCode.getOrElse("none")})")
    }

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

object BaseOcrExtractor extends Logging {

  /**
   * The outcome of picking the 'best' OCR run for a document.
   *
   * @param ocrLanguage         the language we ran OCR in (ie a key of the textByLanguage map, always a supported [[Language]])
   * @param detectedLanguageCode the iso639-1 code tika actually detected in that OCR output. This is NOT necessarily
   *                             one of our supported languages - a Dutch document OCR'd in English will still produce
   *                             mostly readable Dutch text, so we report `nl` here even though Dutch is not an
   *                             ingestion language. Downstream translation decisions must use this, not the OCR language.
   */
  private[ocr] case class BestLanguage(ocrLanguage: Language, detectedLanguageCode: String)

  private case class BestLanguageResult(score: Double, chunkCount: Int, language: Language, detectedLanguageCode: String) {
    val matchesOcrLanguage: Boolean = detectedLanguageCode == language.iso6391Code
  }

  /**
   * We OCR once per ingestion language, so a Russian document is also OCR'd in English, producing garbage. Here we use
   * 3 signals to pick the 'best' language - does it match the OCR language, what is the tikka confidence and how many
   * chunks did that language get selected in.
   */
  private[ocr] def bestOcrLanguage(textByLanguage: Map[Language, String], languageDetector: LanguageDetector): Option[BestLanguage] = {
    val matchingLanguages = textByLanguage.toList.flatMap { case (lang, text) =>
      detectLanguageChunked(languageDetector, s"${lang.key} ocr", text)
        .map(detected => BestLanguageResult(detected.score, detected.chunkCount.getOrElse(0), lang, detected.detectedLanguage))
    }
    val sortedLanguages = matchingLanguages.sortBy{ language =>
      val ocrMatchScore = if (language.matchesOcrLanguage) 1 else 0
      (-ocrMatchScore, -language.score, -language.chunkCount)
    }
    sortedLanguages.headOption.map(best => BestLanguage(best.language, best.detectedLanguageCode))
  }

  /**
   * Attempts to pick the best OCR language and, if non english, add a translation extractor TODO
   */
  def handleOcrTranslation(uri: Uri, textByLanguage: Map[Language, String], index: Index,
                           ingestionServices: IngestionServices, params: ExtractionParams)(implicit ec: ExecutionContext): Unit = {

    val bestLanguage = bestOcrLanguage(textByLanguage, ingestionServices.languageDetector.get())
    // if we get a decent match, save it in the translation data even if it's english. We record the OCR language and
    // the detected language separately as they can legitimately differ (eg a Dutch document OCR'd in English)
    bestLanguage.foreach { best =>
      if (!best.ocrLanguage.iso6391Code.equals(best.detectedLanguageCode)) {
        logger.info(s"${best.ocrLanguage.key} OCR of ${uri.value} was detected as '${best.detectedLanguageCode}'")
      }
      index.addDocumentOcrTranslationData(uri, best.ocrLanguage, best.detectedLanguageCode).awaitEither(10.second)
    }
    // if the *detected* language is not english, add translation extractor TODO. Note this deliberately uses the
    // detected code so we still translate documents in languages we don't OCR in.
    bestLanguage.filter(best => isNotEnglish(best.detectedLanguageCode))
      .foreach { best =>
        logger.info(s"Selected ${best.ocrLanguage.key} OCR of ${uri.value} (detected '${best.detectedLanguageCode}') for translation")
        ingestionServices.addTranslationTodo(uri, params, classOf[ExternalOcrTranslationExtractor].getSimpleName)
      }
  }
}
