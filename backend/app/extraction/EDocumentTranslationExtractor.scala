package extraction

import model.index.LanguageData
import services.index.Index
import services.manifest.Manifest
import services.{ObjectStorage, TranscribeConfig}
import software.amazon.awssdk.services.sqs.SqsClient

import scala.concurrent.ExecutionContext

/**
  * Translation extractor responsible for the document body `text` field of the language data. Triggered by the
  * DocumentBodyExtractor when it detects non-English text.
  */
class EDocumentTranslationExtractor(manifest: Manifest, index: Index, transcribeConfig: TranscribeConfig, transcriptionServiceBucket: ObjectStorage, sqsClient: SqsClient)(implicit executionContext: ExecutionContext)
  extends ExternalTranslationExtractor(manifest, index, transcribeConfig, transcriptionServiceBucket, sqsClient) {

  override def filterRelevantFields(languageData: Option[LanguageData]): Option[LanguageData] = {
    languageData.flatMap { ld =>
      val filtered = ld.copy(emailSubject = None, emailBody = None, ocr = None)
      if (filtered.text.isDefined) Some(filtered) else None
    }
  }
}
