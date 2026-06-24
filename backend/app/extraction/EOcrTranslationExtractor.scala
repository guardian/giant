package extraction

import model.index.LanguageData
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

  override def filterRelevantFields(languageData: Option[LanguageData]): Option[LanguageData] = {
    languageData.flatMap { ld =>
      val filtered = ld.copy(text = None, emailSubject = None, emailBody = None)
      if (filtered.ocr.isDefined) Some(filtered) else None
    }
  }
}
