package extraction

import cats.syntax.either._
import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.{DeleteMessageRequest, Message, ReceiveMessageRequest, SendMessageRequest}
import model.{English, Languages, Uri}
import play.api.libs.json.{JsError, JsSuccess, Json}
import services.index.Index
import services.manifest.WorkerManifest
import services.{ObjectStorage, TranscribeConfig}
import utils.Logging
import utils.attempt.{DocumentUpdateFailure, ExternalTranscriptionOutputFailure, Failure, JsonParseFailure}

import java.nio.charset.StandardCharsets
import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.CollectionHasAsScala
import scala.util.Try

case class TranscriptionMessageAttribute(receiveCount: Int, messageGroupId: String)
case class TranscriptionTexts(transcript: String, translation: Option[String])

class ExternalTranscriptionWorker(manifest: WorkerManifest, amazonSQSClient: AmazonSQS, transcribeConfig: TranscribeConfig, blobStorage: ObjectStorage, index: Index)(implicit executionContext: ExecutionContext)  extends Logging{

  val EXTRACTOR_NAME = "ExternalTranscriptionExtractor"
  val MAX_RECEIVE_COUNT = 3

  def pollForResults(): Int  = {
    logger.info(s"Fetching messages from external transcription output queue ${transcribeConfig.transcriptionOutputQueueUrl}")

    val messages = amazonSQSClient.receiveMessage(
      new ReceiveMessageRequest(transcribeConfig.transcriptionOutputQueueUrl)
        .withMaxNumberOfMessages(10)
        .withAttributeNames("MessageGroupId", "ApproximateReceiveCount")
    ).getMessages

    if (messages.size() > 0)
      logger.info(s"retrieved ${messages.size()} messages from queue Transcription Output Queue")
    else
      logger.info("No sqs message found")

    val messagesCompleted = messages.asScala.toList.foldLeft(0) { (completed, message) =>
      getMessageAttribute(message) match {
        case Right(messageAttributes) =>
          handleMessage(message, messageAttributes, completed)
        case Left(error) =>
          logger.error(s"Could not get message attributes from transcription output message hence can not update extractor. Message id: ${message.getMessageId}", error)
          completed
      }
    }

    logger.info(s"${messagesCompleted} out of ${messages.size()} number of messages successfully completed")

    messagesCompleted
  }

  private def handleMessage(message: Message, messageAttributes: TranscriptionMessageAttribute, completed: Int) = {
    val result = for {
      transcriptionOutput <- parseMessage(message)
      transcripts <- getTranscripts(transcriptionOutput)
      _ <- addDocumentTranscription(transcriptionOutput, transcripts.transcripts.text, transcripts.transcriptTranslations.map(_.text))
      _ <- markExternalExtractorAsComplete(transcriptionOutput.id, EXTRACTOR_NAME)
    } yield {
      amazonSQSClient.deleteMessage(
        new DeleteMessageRequest(transcribeConfig.transcriptionOutputQueueUrl, message.getReceiptHandle)
      )
      logger.debug(s"deleted message for ${transcriptionOutput.id}")
    }

    result match {
      case Right(_) =>
        completed + 1
      case Left(failure: ExternalTranscriptionOutputFailure) =>
        logger.error(failure.msg, failure.toThrowable)
        handleExternalTranscriptionOutputFailure(message, messageAttributes.messageGroupId, failure.msg)
        completed + 1
      case Left(failure) =>
        logger.error(s"failed to process sqs message", failure.toThrowable)
        if (messageAttributes.receiveCount >= MAX_RECEIVE_COUNT) {
          markAsFailure(new Uri(messageAttributes.messageGroupId), EXTRACTOR_NAME, failure.msg)
        }
        completed
    }
  }

  private def getTranscripts(transcriptionOutput: TranscriptionOutputSuccess): Either[Failure, TranscriptionResult] = {
    val combinedTranscripts = blobStorage.get(transcriptionOutput.combinedOutputKey)

    combinedTranscripts.flatMap { transcriptStream =>
      val combinedTranscriptsText = new String(transcriptStream.readAllBytes(), StandardCharsets.UTF_8)
      val parsedTranscripts = Json.fromJson[TranscriptionResult](Json.parse(combinedTranscriptsText))

      parsedTranscripts.asEither.leftMap { errors =>
        JsonParseFailure(errors)
      }
    }
  }

  private def getMessageAttribute(message: Message) = {
    Try {
      val attributes = message.getAttributes
      val receiveCount = attributes.get("ApproximateReceiveCount").toInt
      val messageGroupId = attributes.get("MessageGroupId")
      TranscriptionMessageAttribute(receiveCount, messageGroupId)
    }.toEither
  }

  private def markExternalExtractorAsComplete(id: String, extractorName: String) = {
    val result = manifest.markExternalAsComplete(id, extractorName)
    result.leftMap { failure =>
      logger.error(s"Failed to mark '${id}' processed by $extractorName as complete: ${failure.msg}")
      failure
    }
  }

  private def addDocumentTranscription(transcriptionOutput: TranscriptionOutputSuccess, transcriptText: String, translationText: Option[String]) = {
    Either.catchNonFatal {
      index.addDocumentTranscription(Uri(transcriptionOutput.originalFilename), transcriptText, translationText, Languages.getByIso6391Code(transcriptionOutput.languageCode).getOrElse(English))
        .recoverWith {
          case _ =>
            val msg = s"Failed to write transcript result to elasticsearch. Transcript language: ${transcriptionOutput.languageCode}"
            // throw the error - will be caught by catchNonFatal
            throw new Error(msg)
        }
      ()
    }.leftMap {
      case error => DocumentUpdateFailure.apply(error)
    }
  }

  private def parseMessage(message: Message): Either[Failure, TranscriptionOutputSuccess] = {
    val json = Json.parse(message.getBody)

    Json.fromJson[TranscriptionOutput](json) match {
      case JsSuccess(output: TranscriptionOutputSuccess, _) =>
        Right(output)

      case JsSuccess(output: TranscriptionOutputFailure, _) =>
        Left(ExternalTranscriptionOutputFailure.apply(s"External transcription service failed to transcribe the file ${output.originalFilename}"))

      case JsError(errors) =>
        Left(JsonParseFailure(errors))
    }
  }

  private def markAsFailure(uri: Uri, extractorName: String, failureMsg: String): Unit = {
    logger.error(s"Error in '${extractorName} processing ${uri}': ${failureMsg}")

    manifest.logExtractionFailure(uri, extractorName, failureMsg).left.foreach { f =>
      logger.error(s"Failed to log extractor in manifest: ${f.msg}")
    }
  }

  private def handleExternalTranscriptionOutputFailure(message: Message, id: String, failureMessage: String) = {
    Try {
      val sendMessageCommand = new SendMessageRequest()
        .withQueueUrl(transcribeConfig.transcriptionOutputDeadLetterQueueUrl)
        .withMessageBody(message.getBody)
        .withMessageGroupId(id)
      amazonSQSClient.sendMessage(sendMessageCommand)
      logger.info(s"moved message $id to output dead letter queue")

      amazonSQSClient.deleteMessage(
        new DeleteMessageRequest(transcribeConfig.transcriptionOutputQueueUrl, message.getReceiptHandle)
      )
      logger.debug(s"deleted message $id")

      markAsFailure(new Uri(id), EXTRACTOR_NAME, failureMessage)
    }.toEither match {
      case Right(_) => ()
      case Left(error) => logger.error(s"failed to handle external transcript output failure message", error)
    }
  }
}
