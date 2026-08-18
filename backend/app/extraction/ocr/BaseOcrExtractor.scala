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

object BaseOcrExtractor extends Logging {

  private case class BestLanguageResult(score: Double, chunkCount: Int, language: Language, matchesOcrLanguage: Boolean)

  /**
   * We OCR once per ingestion language, so a Russian document is also OCR'd in English, producing garbage. Here we use
   * 3 signals to pick the 'best' language - does it match the OCR language, what is the tikka confidence and how many
   * chunks did that language get selected in.
   */
  private[ocr] def bestOcrLanguage(textByLanguage: Map[Language, String], languageDetector: LanguageDetector): Option[Language] = {
    val matchingLanguages = textByLanguage.toList.flatMap { case (lang, text) =>
      detectLanguageChunked(languageDetector, s"${lang.key} ocr", text)
        .map(detected => BestLanguageResult(detected.score, detected.chunkCount.getOrElse(0), lang, detected.detectedLanguage == lang.iso6391Code))
    }
    val sortedLanguages = matchingLanguages.sortBy{ language =>
      val ocrMatchScore = if (language.matchesOcrLanguage) 1 else 0
      (-ocrMatchScore, -language.score, -language.chunkCount)
    }
    sortedLanguages.headOption.map(_.language)
  }

  /**
   * Attempts to pick the best OCR language and, if non english, add a translation extractor TODO
   */
  def handleOcrTranslation(uri: Uri, textByLanguage: Map[Language, String], index: Index,
                           ingestionServices: IngestionServices, params: ExtractionParams)(implicit ec: ExecutionContext): Unit = {

    val bestLanguage = bestOcrLanguage(textByLanguage, ingestionServices.languageDetector.get())
    // if we get a decent match, save it in the translation data even if it's english
    bestLanguage.foreach { lang =>
      index.addDocumentOcrTranslationData(uri, lang, lang.iso6391Code).awaitEither(10.second)
    }
    // if the best language is not english, add translation extractor TODO
    bestLanguage.filter(lang => isNotEnglish(lang.iso6391Code))
      .foreach { lang =>
        logger.info(s"Selected ${lang.key} OCR of ${uri.value} for translation")
        ingestionServices.addTranslationTodo(uri, params, classOf[ExternalOcrTranslationExtractor].getSimpleName)
      }
  }
}
