package extraction

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.{MessageAttributeValue, SendMessageRequest}
import model.manifest.Blob
import org.joda.time.DateTime
import play.api.libs.json.{JsError, JsResult, JsValue, Json, Reads}
import services.index.Index
import services.{ObjectStorage, TranscribeConfig}
import utils._
import utils.attempt.Failure

import java.util.UUID
import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.MapHasAsJava

case class SignedUrl(url: String, key: String)

object SignedUrl {
  implicit val formats = Json.format[SignedUrl]
}
case class OutputBucketUrls(zip: SignedUrl)
case class OutputBucketKeys(zip: String)
case class TranscriptionJob(id: String, originalFilename: String, inputSignedUrl: String, sentTimestamp: String,
                            userEmail: String, transcriptDestinationService: String, outputBucketUrls: OutputBucketUrls,
                            languageCode: String, translate: Boolean, translationOutputBucketUrls: OutputBucketUrls,
                            diarize: Boolean = false, engine: String = "whispercpp")
object OutputBucketUrls {
  implicit val formats = Json.format[OutputBucketUrls]
}

object OutputBucketKeys {
  implicit val formats = Json.format[OutputBucketKeys]
}
object TranscriptionJob {
  implicit val formats = Json.format[TranscriptionJob]
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
                                          outputBucketKeys: OutputBucketKeys,
                                          translationOutputBucketKeys: Option[OutputBucketKeys]
                                        ) extends TranscriptionOutput

case class TranscriptionOutputFailure(
                                      id: String,
                                      originalFilename: String,
                                      userEmail: String,
                                      isTranslation: Boolean,
                                      status: String = "FAILURE"
                                    ) extends TranscriptionOutput

object TranscriptionOutputSuccess {
  implicit val format = Json.format[TranscriptionOutputSuccess]
}

object TranscriptionOutputFailure {
  implicit val format = Json.format[TranscriptionOutputFailure]
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

class ExternalTranscriptionExtractor(index: Index, transcribeConfig: TranscribeConfig, transcriptionStorage: ObjectStorage, outputStorage: ObjectStorage, amazonSQSClient: AmazonSQS)(implicit executionContext: ExecutionContext) extends ExternalExtractor with Logging {
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

  private def getOutputBucketUrls(blobUri: String): Either[Failure, OutputBucketUrls] = {
    val zipKey = s"zip/$blobUri.zip"

    val bucketUrls = for {
      zip <- outputStorage.getUploadSignedUrl(zipKey)
    } yield {
      OutputBucketUrls(
        SignedUrl(zip, zipKey),
      )
    }

    bucketUrls
  }

  override def triggerExtraction(blob: Blob, params: ExtractionParams): Either[Failure, Unit] = {
    val transcriptionJob =  for {
      downloadSignedUrl <- transcriptionStorage.getSignedUrl (blob.uri.toStoragePath)
      transcriptsOutputSignedUrls <- getOutputBucketUrls(blob.uri.value)
      translationOutputSignedUrls <- getOutputBucketUrls(s"${blob.uri.value}-translation")
    } yield {
      TranscriptionJob(blob.uri.value, blob.uri.value, downloadSignedUrl, DateTime.now().toString, "giant", "Giant",
        transcriptsOutputSignedUrls, "auto", true, translationOutputSignedUrls)
    }

    transcriptionJob.flatMap {
      job => {
        try {
          logger.info(s"sending message to Transcription Service Queue")

          val sendMessageCommand = new SendMessageRequest()
            .withQueueUrl(transcribeConfig.transcriptionServiceQueueUrl)
            .withMessageBody(Json.stringify(Json.toJson(job)))
            .withMessageGroupId(UUID.randomUUID().toString)
            .withMessageAttributes(
              Map("BlobId" -> new MessageAttributeValue().withDataType("String").withStringValue(blob.uri.value)).asJava
            )
          Right(amazonSQSClient.sendMessage(sendMessageCommand))
        } catch {
          case e: Failure => Left(e)
        }
      }
    }
  }
}
