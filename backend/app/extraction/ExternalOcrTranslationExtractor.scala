package extraction

import model.{English, TranslationField, TranslationTask}
import model.index.{Document, IndexedResource}
import services.index.{Index, IndexFields}
import services.manifest.Manifest
import services.{ObjectStorage, TranscribeConfig, TranslationConfig}
import software.amazon.awssdk.services.sqs.SqsClient

import scala.concurrent.ExecutionContext

/**
  * Translation extractor responsible for the `ocr` field of the language data. Triggered by the OCR extractors when
  * they detect non-English OCR text. We OCR in several languages but only ever translate the one recorded in
  * `translationData.ocr.ocrLanguage`.
  */
class ExternalOcrTranslationExtractor(manifest: Manifest, index: Index, transcribeConfig: TranscribeConfig, translateConfig: TranslationConfig, transcriptionServiceBucket: ObjectStorage, sqsClient: SqsClient)(implicit executionContext: ExecutionContext)
  extends ExternalTranslationExtractor(manifest, index, transcribeConfig, translateConfig, transcriptionServiceBucket, sqsClient) {


  override def getTranslationTask(resource: IndexedResource): Option[TranslationTask] = {
    for {
      document <- resource match {
        case doc: Document => Some(doc)
        case _ => None
      }
      ocrLanguageData <- document.translationData.flatMap(_.ocr)
      if ocrLanguageData.detectedLanguageCode != English.iso6391Code
      text <- document.ocr.flatMap(_.get(ocrLanguageData.ocrLanguage))
    } yield {
      TranslationTask(
        systemPrompt = getSystemPrompt(List(ocrLanguageData.detectedLanguageCode)),
        fields = List(TranslationField(name = IndexFields.translationData.ocr, text = text))
      )
    }
  }
}
