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
    val translationData = resource match {
      case doc: Document if doc.languageData.isDefined => Some(doc.text, doc.languageData.get)
      case _ => None
    }
    val field = translationData.flatMap(_._2.text)

    val detectedLanguage = field.flatMap(_.detectedLanguageCode)
    val textToTranslate = translationData.map(_._1)
    detectedLanguage.flatMap { dlc =>
      if (dlc != English.iso6391Code && textToTranslate.isDefined) {
        Some(TranslationTask(
          systemPrompt = getSystemPrompt(List(dlc)),
          fields = List(TranslationField("text", textToTranslate.get))
        ))
      } else None
    }


    }

}
