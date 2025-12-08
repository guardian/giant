package extraction

import software.amazon.awssdk.services.sqs.SqsClient
import software.amazon.awssdk.services.sqs.model.{MessageAttributeValue, SendMessageRequest}
import model.{English, Language, Languages}
import model.manifest.Blob
import org.joda.time.DateTime
import play.api.libs.json.{Format, JsError, JsResult, JsValue, Json, Reads, Writes}
import services.index.Index
import services.{ObjectStorage, TranscribeConfig}
import utils._
import utils.attempt.Failure

import java.util.UUID
import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.MapHasAsJava

// NOTE: these types need to be kept in sync with the corresponding types in the transcription service:
// https://github.com/guardian/transcription-service/blob/main/packages/common/src/types.ts
case class SignedUrl(url: String, key: String)
object SignedUrl {
  implicit val formats: Format[SignedUrl] = Json.format[SignedUrl]
}
case class CombinedOutputUrl(url: String, key: String)
case class TranscriptionJob(id: String, originalFilename: String, inputSignedUrl: String, sentTimestamp: String,
                            userEmail: String, transcriptDestinationService: String,
                            combinedOutputUrl: CombinedOutputUrl, languageCode: String, translate: Boolean,
                            diarize: Boolean, engine: String, ingestion: String)

object TranscriptionJob {
  implicit val combinedOutputUrlFormat: Format[CombinedOutputUrl] = Json.format[CombinedOutputUrl]
  implicit val formats: Format[TranscriptionJob] = Json.format[TranscriptionJob]
}
case class TranscriptionMetadata(detectedLanguageCode: Language)
object TranscriptionMetadata {
  implicit val languageReads: Reads[Language] = Reads.of[String].map { code =>
    Languages.getByIso6391Code(code).getOrElse(English)
  }
  implicit val languageWrites: Writes[Language] = Writes.of[String].contramap(_.iso6391Code)
  implicit val formats: Format[TranscriptionMetadata] = Json.format[TranscriptionMetadata]
}
case class Transcripts(srt: String, text: String, json: String)
case class TranscriptionResult(transcripts: Transcripts, transcriptTranslations: Option[Transcripts], metadata: TranscriptionMetadata)
object TranscriptionResult {
  implicit val transcriptsFormat: Format[Transcripts] = Json.format[Transcripts]
  implicit val formats: Format[TranscriptionResult] = Json.format[TranscriptionResult]
}

sealed trait TranscriptionOutput {
  def id: String
  def originalFilename: String
  def userEmail: String
  def isTranslation: Boolean
  def status: String
}

case class TranscriptionOutputSuccess(
                                          id: String,
                                          originalFilename: String,
                                          userEmail: String,
                                          isTranslation: Boolean,
                                          status: String = "SUCCESS",
                                          languageCode: String,
                                          combinedOutputKey: String,
                                        ) extends TranscriptionOutput

case class TranscriptionOutputFailure(
                                      id: String,
                                      originalFilename: String,
                                      userEmail: String,
                                      isTranslation: Boolean,
                                      status: String = "FAILURE"
                                    ) extends TranscriptionOutput

object TranscriptionOutputSuccess {
  implicit val format: Format[TranscriptionOutputSuccess] = Json.format[TranscriptionOutputSuccess]
}

object TranscriptionOutputFailure {
  implicit val format: Format[TranscriptionOutputFailure] = Json.format[TranscriptionOutputFailure]
}

object TranscriptionOutput {
  // Custom Reads to handle both message types
  implicit val transcriptionOutputReads: Reads[TranscriptionOutput] = new Reads[TranscriptionOutput] {
    def reads(json: JsValue): JsResult[TranscriptionOutput] = {
      (json \ "status").as[String] match {
        // NOTE: These statuses are defined in the transcription service:
        // https://github.com/guardian/transcription-service/blob/main/packages/common/src/types.ts
        case "SUCCESS" => json.validate[TranscriptionOutputSuccess]
        case "TRANSCRIPTION_FAILURE" => json.validate[TranscriptionOutputFailure]
        case other     => JsError(s"Unknown status type: $other")
      }
    }
  }
}

// The transcription types are matched with types in transcription service
// https://github.com/guardian/transcription-service/blob/main/packages/common/src/types.ts

class ExternalTranscriptionExtractor(index: Index, transcribeConfig: TranscribeConfig, transcriptionStorage: ObjectStorage, outputStorage: ObjectStorage, sqsClient: SqsClient)(implicit executionContext: ExecutionContext) extends ExternalExtractor with Logging {
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
        languageCode = "auto",
        translate = true,
        diarize = true,
        engine = "whisperx",
        ingestion = params.ingestion)
    }

    transcriptionJob.flatMap {
      job => {
        try {
          logger.info(s"sending message to Transcription Service Queue")

          val messageRequest = SendMessageRequest.builder()
            .queueUrl(transcribeConfig.transcriptionServiceQueueUrl)
            .messageBody(Json.stringify(Json.toJson(job)))
            .messageGroupId(UUID.randomUUID().toString)
            .messageAttributes(Map("BlobId" -> MessageAttributeValue.builder()
              .dataType("String")
              .stringValue(blob.uri.value).build()).asJava)
            .build()
          Right(sqsClient.sendMessage(messageRequest))
        } catch {
          case e: Failure => Left(e)
        }
      }
    }
  }
}
