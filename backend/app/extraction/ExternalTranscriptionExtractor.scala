package extraction

import software.amazon.awssdk.services.sqs.SqsClient
import model.{CombinedOutputUrl, English, Language, Languages, LlmOutputFailure, LlmOutputSuccess, TranscriptionJob, TranscriptionJobType, TranscriptionOutput, TranscriptionOutputFailure, TranscriptionOutputSuccess}
import model.manifest.Blob
import org.joda.time.DateTime
import play.api.libs.json.{JsError, JsResult, JsValue, Json, Reads}
import services.index.Index
import services.{ObjectStorage, TranscribeConfig}
import utils._
import utils.attempt.Failure

import scala.concurrent.ExecutionContext

class ExternalTranscriptionExtractor(index: Index, transcribeConfig: TranscribeConfig, transcriptionStorage: ObjectStorage, outputStorage: ObjectStorage, sqsClient: SqsClient)(implicit executionContext: ExecutionContext) extends ExternalExtractor {
  val mimeTypes: Set[String] = Set(
    "audio/wav",
    "audio/vnd.wave",
    "audio/x-aiff", // converted and transcribed. But preview doesn't work
    "audio/mpeg",
    "audio/aac", // tika can't detect this!!
    "audio/vorbis", // Converted by ffmpeg but failed in whisper
    "audio/opus",
    "audio/amr", // converted and transcribed. But preview doesn't work
    "audio/amr-wb", // Couldn't find a sample to test
    "audio/x-caf", // Couldn't find a sample to test
    "audio/mp4", // Couldn't find a sample to test
    "audio/x-ms-wma", // converted and transcribed. But preview doesn't work
    "video/3gpp",
    "video/mp4", // quicktime detected for some of mp4 samples
    "video/quicktime",
    "video/x-flv", // converted and transcribed. But preview doesn't work
    "video/x-ms-wmv", // converted and transcribed. But preview doesn't work
    "video/x-msvideo", // converted and transcribed. But preview doesn't work
    "video/x-m4v",
    "video/mpeg" // converted and transcribed. But preview doesn't work
  )

  def canProcessMimeType: String => Boolean = mimeTypes.contains

  override def indexing = true
  // set a low priority as transcription takes a long time, we don't want to block up the workers
  override def priority = 2


  override def triggerExtraction(blob: Blob, params: ExtractionParams): Either[Failure, Unit] = {
    val combinedOutputKey = s"combined/${blob.uri.value}.json"
    val transcriptionJob =  for {
      downloadSignedUrl <- transcriptionStorage.getSignedUrl (blob.uri.toStoragePath)
      combinedOutputUrl <- outputStorage.getUploadSignedUrl(combinedOutputKey)
    } yield {
      TranscriptionJob(
        id = blob.uri.value,
        originalFilename = blob.uri.value,
        inputSignedUrl = downloadSignedUrl,
        sentTimestamp = DateTime.now().toString,
        userEmail = "giant",
        transcriptDestinationService = "Giant",
        combinedOutputUrl = CombinedOutputUrl(url = combinedOutputUrl,key = combinedOutputKey),
        languageCode = params.languages.headOption.map { lang: Language =>
          if (lang.iso6391Code == English.iso6391Code) {
            // We only recently added language support to workspace uploads, previously we set the language of the ingestion
            // for every upload to English, so we can't rely on the language if it is set to English
            "auto"
          } else {
            lang.iso6391Code
          }
        }.getOrElse("auto"),
        translate = true,
        diarize = true,
        engine = "whisperx",
        ingestion = params.ingestion, jobType = TranscriptionJobType.name)
    }

    transcriptionJob.flatMap { job =>
      sendToQueue(sqsClient, transcribeConfig.transcriptionServiceQueueUrl, job, blob.uri.value, name)
    }
  }
}
