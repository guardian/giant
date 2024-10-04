package extraction

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.SendMessageRequest
import model.manifest.Blob
import org.joda.time.DateTime
import play.api.libs.json.Json
import services.index.Index
import services.{ObjectStorage, TranscribeConfig}
import utils._
import utils.attempt.Failure

import java.util.UUID
import scala.concurrent.ExecutionContext

case class SignedUrl(url: String, key: String)

object SignedUrl {
  implicit val formats = Json.format[SignedUrl]
}
case class OutputBucketUrls(text: SignedUrl, srt: SignedUrl, json: SignedUrl)
case class OutputBucketKeys(text: String, srt: String, json: String)
case class TranscriptionJob(id: String, originalFilename: String, inputSignedUrl: String, sentTimestamp: String,
                            userEmail: String, transcriptDestinationService: String, outputBucketUrls: OutputBucketUrls,
                            languageCode: String, translate: Boolean)
object OutputBucketUrls {
  implicit val formats = Json.format[OutputBucketUrls]
}

object OutputBucketKeys {
  implicit val formats = Json.format[OutputBucketKeys]
}
object TranscriptionJob {
  implicit val formats = Json.format[TranscriptionJob]
}

/**
  * id: z.string(),
  * originalFilename: z.string(),
  * userEmail: z.string(),
  * status: z.literal('SUCCESS'),
  * languageCode: z.string(),
  * outputBucketKeys: OutputBucketKeys,
  */

case class TranscriptionOutput(id: String, originalFilename: String, userEmail: String, status: String, languageCode: String, outputBucketKeys: OutputBucketKeys)
object TranscriptionOutput {
  implicit val formats = Json.format[TranscriptionOutput]
}

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
    val srtKey = s"srt/$blobUri.srt"
    val jsonKey = s"json/$blobUri.json"
    val textKey = s"text/$blobUri.txt"

    val bucketUrls = for {
      srt <- outputStorage.getUploadSignedUrl(srtKey)
      json <- outputStorage.getUploadSignedUrl(jsonKey)
      text <- outputStorage.getUploadSignedUrl(textKey)
    } yield {
      OutputBucketUrls(
        SignedUrl(text, textKey),
        SignedUrl(srt, srtKey),
        SignedUrl(json, jsonKey)
      )
    }

    bucketUrls
  }

  override def triggerExtraction(blob: Blob, params: ExtractionParams): Either[Failure, Unit] = {
    val transcriptionJob =  for {
      downloadSignedUrl <- transcriptionStorage.getSignedUrl (blob.uri.toStoragePath)
      outputSignedUrls <- getOutputBucketUrls(blob.uri.value)
    } yield {
      TranscriptionJob(blob.uri.value, blob.uri.value, downloadSignedUrl, DateTime.now().toString, "giant", "Giant",
        outputSignedUrls, "auto", false)
    }

    transcriptionJob.flatMap {
      job => {
        try {
          logger.info(s"sending message to Transcription Service Queue")

          val sendMessageCommand = new SendMessageRequest()
            .withQueueUrl(transcribeConfig.transcriptionServiceQueueUrl)
            .withMessageBody(Json.stringify(Json.toJson(job)))
            .withMessageGroupId(UUID.randomUUID().toString)
          Right(amazonSQSClient.sendMessage(sendMessageCommand))
        } catch {
          case e: Failure => Left(e)
        }
      }
    }
  }
}
