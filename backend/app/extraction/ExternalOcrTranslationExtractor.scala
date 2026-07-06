package extraction

import model.{English, TranslationField, TranslationTask}
import model.index.{Document, IndexedResource}
import services.index.Index
import services.manifest.Manifest
import services.{ObjectStorage, TranscribeConfig, TranslationConfig}
import software.amazon.awssdk.services.sqs.SqsClient

import scala.concurrent.ExecutionContext

/**
  * Translation extractor responsible for the `ocr` field of the language data. Triggered by the OcrMyPdfExtractor when
  * it detects non-English OCR text.
  */
class ExternalOcrTranslationExtractor(manifest: Manifest, index: Index, transcribeConfig: TranscribeConfig, translateConfig: TranslationConfig, transcriptionServiceBucket: ObjectStorage, sqsClient: SqsClient)(implicit executionContext: ExecutionContext)
  extends ExternalTranslationExtractor(manifest, index, transcribeConfig, translateConfig, transcriptionServiceBucket, sqsClient) {


  override def getTranslationTask(resource: IndexedResource): Option[TranslationTask] = {
    for {
      document <- resource match {
        case doc: Document => Some(doc)
        case _ => None
      }
      ocrLanguageData <- document.languageData.flatMap(_.ocr)
      nonEnglishLanguages = ocrLanguageData.detectedLanguageCode.filterNot(_._2 == English.iso6391Code)
      documentOcr <- document.ocr
      translationFields = nonEnglishLanguages.keys.toList.flatMap { lang =>
        documentOcr.get(lang).map { langText =>
          TranslationField(
            name = s"ocr_$lang",
            text = langText
          )
        }
      }
      if translationFields.nonEmpty
    } yield {
      TranslationTask(
        systemPrompt = getSystemPrompt(nonEnglishLanguages.values.toList),
        fields = translationFields
      )
    }
  }
}
