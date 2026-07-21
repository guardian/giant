package extraction

import model.{English, TranslationField, TranslationTask}
import model.index.{Document, IndexedResource, LanguageData}
import services.index.Index
import services.manifest.Manifest
import services.{ObjectStorage, TranscribeConfig, TranslationConfig}
import software.amazon.awssdk.services.sqs.SqsClient

import scala.concurrent.ExecutionContext

/**
  * Translation extractor responsible for the document body `text` field of the language data. Triggered by the
  * DocumentBodyExtractor when it detects non-English text.
  */
class ExternalDocumentTranslationExtractor(manifest: Manifest, index: Index, transcribeConfig: TranscribeConfig, translateConfig: TranslationConfig, transcriptionServiceBucket: ObjectStorage, sqsClient: SqsClient)(implicit executionContext: ExecutionContext)
  extends ExternalTranslationExtractor(manifest, index, transcribeConfig, translateConfig, transcriptionServiceBucket, sqsClient) {

  override def getTranslationTask(resource: IndexedResource): Option[TranslationTask] = {
    for {
      document <- resource match {
        case doc: Document if doc.languageData.isDefined => Some(doc)
        case _ => None
      }
      detectedLanguageCode <- document.languageData.flatMap(_.text.flatMap(_.detectedLanguageCode))
      if detectedLanguageCode != English.iso6391Code && document.text.nonEmpty
    } yield {
      TranslationTask(
          systemPrompt = getSystemPrompt(List(detectedLanguageCode)),
          fields = List(TranslationField("text", document.text))
        )
    }
  }

}
