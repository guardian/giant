package extraction

import model.{English, TranslationField, TranslationTask}
import model.index.{Document, IndexedResource}
import services.index.Index
import services.manifest.Manifest
import services.{ObjectStorage, TranscribeConfig}
import software.amazon.awssdk.services.sqs.SqsClient

import scala.concurrent.ExecutionContext

/**
  * Translation extractor responsible for the `ocr` field of the language data. Triggered by the OcrMyPdfExtractor when
  * it detects non-English OCR text.
  */
class EOcrTranslationExtractor(manifest: Manifest, index: Index, transcribeConfig: TranscribeConfig, transcriptionServiceBucket: ObjectStorage, sqsClient: SqsClient)(implicit executionContext: ExecutionContext)
  extends ExternalTranslationExtractor(manifest, index, transcribeConfig, transcriptionServiceBucket, sqsClient) {


  override def getTranslationTask(resource: IndexedResource): Option[TranslationTask] = {
    val documentData = resource match {
      case doc: Document if doc.languageData.isDefined && doc.ocr.exists(_.nonEmpty) =>
        Some((doc.languageData.get, doc.ocr.get))
      case _ => None
    }

    documentData.flatMap { case (languageData, ocrTexts) =>
      languageData.ocr.flatMap { ocr =>
        val nonEnglishOcrLanguages = ocr.detectedLanguageCode.filterNot(_._2 == English.iso6391Code)

        val fields = nonEnglishOcrLanguages.keys.toList.flatMap { lang =>
          ocrTexts.get(lang).map { langText =>
            TranslationField(
              name = s"ocr_$lang",
              text = langText
            )
          }
        }

        if (fields.nonEmpty) {
          Some(TranslationTask(
            systemPrompt = getSystemPrompt(nonEnglishOcrLanguages.values.toList),
            fields = fields
          ))
        } else None
      }
    }

  }
}
