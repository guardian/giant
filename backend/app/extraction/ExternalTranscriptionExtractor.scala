package extraction

import cats.syntax.either._
import com.amazonaws.services.sqs.{AmazonSQS, AmazonSQSClient}
import com.amazonaws.services.sqs.model.ReceiveMessageRequest
import model.manifest.Blob
import model.{English, Languages, Uri}
import org.apache.commons.io.FileUtils
import org.joda.time.DateTime
import play.api.libs.json.Json
import services.{ObjectStorage, ScratchSpace, TranscribeConfig, WorkerConfig}
import services.index.Index
import utils.FfMpeg.FfMpegSubprocessCrashedException
import utils.attempt.{Failure, FfMpegFailure, UnknownFailure}
import utils._

import scala.concurrent.ExecutionContext
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.UUID


case class OutputBucketUrls(txt: String, srt: String, json: String)
case class TranscriptionJob(id: String, originalFilename: String, inputSignedUrl: String, sentTimestamp: String,
                            userEmail: String, transcriptDestinationService: String, outputBucketUrls: OutputBucketUrls,
                            languageCode: String)
object OutputBucketUrls {
  implicit val formats = Json.format[OutputBucketUrls]

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

case class TranscriptionOutput(id: String, originalFilename: String, userEmail: String, status: String, languageCode: String, outputBucketUrls: OutputBucketUrls)
object TranscriptionOutput {
  implicit val formats = Json.format[TranscriptionOutput]
}

class ExternalTranscriptionExtractor(index: Index, transcribeConfig: TranscribeConfig, blobStorage: ObjectStorage, amazonSQSClient: AmazonSQS)(implicit executionContext: ExecutionContext) extends ExternalExtractor with Logging {
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

  private val dataBucketPrefix = "transcription-service-output-data"
  private def getOutputBucketUrls(blobUri: String): OutputBucketUrls = {
    val txt = s"$dataBucketPrefix/$blobUri.txt"
    // we should find a way to avoid having to provide these
    val srt = s"$dataBucketPrefix/$blobUri.srt"
    val json = s"$dataBucketPrefix/$blobUri.json"
    OutputBucketUrls(txt, srt, json)
  }

  private def postToTranscriptionQueue(blobUri: String, signedUrl: String) = {
    val transcriptionJob = TranscriptionJob(UUID.randomUUID().toString, blobUri, signedUrl, DateTime.now().toString, "giant", "Giant",
      getOutputBucketUrls(blobUri), "")
    amazonSQSClient.sendMessage(transcribeConfig.transcriptionServiceQueueUrl, Json.stringify(Json.toJson(transcriptionJob)))
  }

  override def triggerExtraction(blob: Blob, params: ExtractionParams): Either[Failure, Unit] = {
    blobStorage.getSignedUrl (blob.uri.value).map {
      url => postToTranscriptionQueue(blob.uri.value, url)
    }
  }
  import scala.jdk.CollectionConverters._

  override def pollForResults(): Either[Failure, Unit] = {
    val messages = amazonSQSClient.receiveMessage(
      new ReceiveMessageRequest(transcribeConfig.transcriptionServiceOutputQueueUrl).withMaxNumberOfMessages(10)
    ).getMessages

    messages.asScala.toList.foreach { message =>
      val transcriptionOutput = Json.parse(message.getBody).as[TranscriptionOutput]
      blobStorage.get(transcriptionOutput.outputBucketUrls.txt).map { inputStream =>
        val txt = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8)
        index.addDocumentTranscription(Uri(transcriptionOutput.originalFilename), txt, None, Languages.getByIso6391Code(transcriptionOutput.languageCode).getOrElse(English))
          .recoverWith {
          case _ =>
            val msg = s"Failed to write transcript result to elasticsearch. Transcript language: ${transcriptionOutput.languageCode}"
            logger.error(msg)
            // throw the error - will be caught by catchNonFatal
            throw new Error(msg)
        }

      }
    }
    Right(())
  }

}
