package extraction

import cats.syntax.either._
import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.{DeleteMessageRequest, Message, ReceiveMessageRequest}
import model.{English, Languages, Uri}
import play.api.libs.json.{Format, JsError, JsSuccess, Json}
import services.index.Index
import services.manifest.WorkerManifest
import services.{ObjectStorage, TranscribeConfig}
import utils.Logging
import utils.attempt.{ExternalTranscriptionFailure, JsonParseFailure}

import java.nio.charset.StandardCharsets
import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.CollectionHasAsScala


class ExternalTranscriptionWorker(manifest: WorkerManifest, amazonSQSClient: AmazonSQS, transcribeConfig: TranscribeConfig, blobStorage: ObjectStorage, index: Index)(implicit executionContext: ExecutionContext)  extends Logging{

  def pollForResults(): Int  = {
    logger.info("Fetching messages from external transcription output queue")
    val messages = amazonSQSClient.receiveMessage(
      new ReceiveMessageRequest(transcribeConfig.transcriptionOutputQueueUrl).withMaxNumberOfMessages(10)
    ).getMessages

    if (messages.size() > 0)
      logger.info(s"retrieved ${messages.size()} messages from queue Transcription Output Queue")
    else logger.info("No message found")

    messages.asScala.toList.foldLeft(0) { (completed, message) =>
      val result = for {
        transcriptionOutput <- parseMessage[TranscriptionOutput](message)
        transcription <- blobStorage.get(transcriptionOutput.outputBucketKeys.text)
        txt = new String(transcription.readAllBytes(), StandardCharsets.UTF_8)
        _ <- addDocumentTranscription(transcriptionOutput, txt)
        _ <- markAsComplete(transcriptionOutput.id, "ExternalTranscriptionExtractor")
      } yield {
        amazonSQSClient.deleteMessage(
          new DeleteMessageRequest(transcribeConfig.transcriptionOutputQueueUrl, message.getReceiptHandle)
        )
        logger.debug(s"deleted message for ${transcriptionOutput.id}")
      }

      result match {
        case Right(_) =>
          completed + 1
        case Left(failure) =>
          logger.error(s"failed to process sqs message, ${failure.msg}", failure.toThrowable)
          completed
      }
    }
  }

  private def markAsComplete(id: String, extractorName: String) = {
    val result = manifest.markExternalAsComplete(id, extractorName)
    result.leftMap { failure =>
      logger.error(s"Failed to mark '${id}' processed by $extractorName as complete: ${failure.msg}")
      failure
    }
  }

  private def addDocumentTranscription(transcriptionOutput: TranscriptionOutput, text: String) = {
    Either.catchNonFatal {
      index.addDocumentTranscription(Uri(transcriptionOutput.originalFilename), text, None, Languages.getByIso6391Code(transcriptionOutput.languageCode).getOrElse(English))
        .recoverWith {
          case _ =>
            val msg = s"Failed to write transcript result to elasticsearch. Transcript language: ${transcriptionOutput.languageCode}"
            // throw the error - will be caught by catchNonFatal
            throw new Error(msg)
        }
      ()
    }.leftMap {
      case error => ExternalTranscriptionFailure.apply(error)
    }
  }

  private def parseMessage[T: Format](message: Message) = {
    val json = Json.parse(message.getBody)

    Json.fromJson[T](json) match {
      case JsSuccess(output, _) => Right(output)
      case JsError(error) => Left(JsonParseFailure(error))
    }
  }
}
