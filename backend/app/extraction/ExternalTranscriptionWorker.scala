package extraction

import cats.syntax.either._
import model.index.LanguageData
import software.amazon.awssdk.services.sqs.SqsClient
import software.amazon.awssdk.services.sqs.model.{DeleteMessageRequest, Message, MessageSystemAttributeName, ReceiveMessageRequest, SendMessageRequest}
import model.{LlmOutputFailure, LlmOutputSuccess, TranscriptionOutput, TranscriptionOutputFailure, TranscriptionOutputSuccess, TranscriptionResult, Uri}
import play.api.libs.json.{JsError, JsSuccess, Json}
import services.index.Index
import services.manifest.WorkerManifest
import services.{ObjectStorage, TranscribeConfig}
import utils.Logging
import utils.attempt.{DocumentUpdateFailure, ExternalTranscriptionOutputFailure, Failure, JsonParseFailure}
import TranscriptionOutput.transcriptionOutputReads

import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.CollectionHasAsScala
import scala.util.Try

case class TranscriptionMessageAttribute(receiveCount: Option[Int], messageGroupId: String, blobId: Option[String], extractorName: Option[String])

class ExternalTranscriptionWorker(manifest: WorkerManifest, sqsClient: SqsClient, transcribeConfig: TranscribeConfig, blobStorage: ObjectStorage, index: Index)(implicit executionContext: ExecutionContext)  extends Logging{

  private val MAX_RECEIVE_COUNT = 3

  def pollForResults(): Int  = {
    logger.info(s"Fetching messages from external transcription output queue ${transcribeConfig.transcriptionOutputQueueUrl}")

    val messages = sqsClient.receiveMessage(ReceiveMessageRequest.builder()
        .queueUrl(transcribeConfig.transcriptionOutputQueueUrl)
        .maxNumberOfMessages(10)
        .messageSystemAttributeNames(MessageSystemAttributeName.MESSAGE_GROUP_ID, MessageSystemAttributeName.APPROXIMATE_RECEIVE_COUNT)
        // request the custom attributes that the transcription worker preserves from the original job so that we can
        // match the output back to the relevant blob/extractor
        .messageAttributeNames("GiantBlobId", "GiantExtractorName")
        .build())
      .messages()

    if (messages.size() > 0)
      logger.info(s"retrieved ${messages.size()} messages from queue Transcription Output Queue")

    val messagesCompleted = messages.asScala.toList.foldLeft(0) { (completed, message) =>
      getMessageAttribute(message) match {
        case Right(messageAttributes) =>
          handleMessage(message, messageAttributes, completed)
        case Left(error) =>
          logger.error(s"Could not get message attributes from transcription output message hence can not update extractor. Message id: ${message.messageId()}", error)
          completed
      }
    }
    if (messages.size() > 0) {
      logger.info(s"${messagesCompleted} out of ${messages.size()} number of messages successfully completed")
    }

    messagesCompleted
  }

  private def handleMessage(message: Message, messageAttributes: TranscriptionMessageAttribute, completed: Int) = {
    val result = parseMessage(message).flatMap { parsedMessage =>
      sqsClient.deleteMessage(
        DeleteMessageRequest.builder()
          .queueUrl(transcribeConfig.transcriptionOutputQueueUrl)
          .receiptHandle(message.receiptHandle())
          .build()
      )
      parsedMessage match {
        case output: TranscriptionOutputSuccess => for {
          transcripts <- getTranscripts(output)
          _ <- addDocumentTranscription(output, transcripts)
          _ <- markExternalExtractorAsComplete(output.id, classOf[ExternalTranscriptionExtractor].getSimpleName)
        } yield {
          logger.info(s"Transcript job ${output.id} processed successfully")
        }
        case output: TranscriptionOutputFailure =>
          if (output.noAudioDetected) {
            logger.info(s"No audio detected in job ${output.id}")
            markExternalExtractorAsComplete(output.id, classOf[ExternalTranscriptionExtractor].getSimpleName)
          } else {
            Left(ExternalTranscriptionOutputFailure.apply(s"External transcription service failed to transcribe the file ${output.originalFilename}"))
          }
        case output: LlmOutputSuccess =>
          logger.info(s"Processing LLM job ${output.id} with output key ${output.outputKey}")
          messageAttributes.extractorName match {
            case Some(extractorName) =>
              for {
                languageData <- getLlmOutput(output)
                _ <- addDocumentTranslation(output, languageData)
                _ <- markExternalExtractorAsComplete(output.id, extractorName)
              } yield {
                logger.info(s"LLM job ${output.id} processed successfully")
              }
            case None =>
              Left(ExternalTranscriptionOutputFailure.apply(s"LLM output message for ${output.id} is missing the GiantExtractorName message attribute, cannot determine which extractor to mark as complete"))
          }
        case output: LlmOutputFailure =>
          Left(ExternalTranscriptionOutputFailure.apply(s"External transcription service failed to translate the file ${output.id}"))
      }
    }

    result match {
      case Right(_) =>
        completed + 1
      case Left(failure: ExternalTranscriptionOutputFailure) =>
        logger.error(failure.msg, failure.toThrowable)
        handleExternalTranscriptionOutputFailure(message, messageAttributes.messageGroupId, messageAttributes.extractorName, failure.msg)
        completed + 1
      case Left(failure) =>
        logger.error(s"failed to process sqs message", failure.toThrowable)
        if (messageAttributes.receiveCount.exists(_ >= MAX_RECEIVE_COUNT)) {
          if (messageAttributes.blobId.isDefined && messageAttributes.extractorName.isDefined) {
            markAsFailure(new Uri(messageAttributes.blobId.get), messageAttributes.extractorName.get, failure.msg)
          } else {
            logger.error(s"Message ${message.messageId()} has exceeded max receive count but does not have blobId or extractorName attributes, cannot mark as failure")
          }
        }
        completed
    }
  }



  private def getLlmOutput(llmOutput: LlmOutputSuccess): Either[Failure, LanguageData] = {
    val llmOutputText = blobStorage.getGzippedText(llmOutput.outputKey)

    llmOutputText.flatMap { output =>
      val parsedLlmOutput = Json.fromJson[LanguageData](Json.parse(output))

      parsedLlmOutput.asEither.leftMap { errors =>
        JsonParseFailure(errors)
      }
    }
  }

  private def getTranscripts(transcriptionOutput: TranscriptionOutputSuccess): Either[Failure, TranscriptionResult] = {
    val transcriptOutput = blobStorage.getGzippedText(transcriptionOutput.combinedOutputKey)

    transcriptOutput.flatMap { output =>
      val parsedTranscripts = Json.fromJson[TranscriptionResult](Json.parse(output))

      parsedTranscripts.asEither.leftMap { errors =>
        JsonParseFailure(errors)
      }
    }
  }

  private def getMessageAttribute(message: Message) = {
    Try {
      val attributes = message.attributes()
      // Receive count should always be defined, but if there is a problem with localstack it can be null, so wrap in an option
      val receiveCount = Option(attributes.get(MessageSystemAttributeName.APPROXIMATE_RECEIVE_COUNT)).map(_.toInt)
      val messageGroupId = attributes.get(MessageSystemAttributeName.MESSAGE_GROUP_ID)
      val blobId = Option(message.messageAttributes().get("GiantBlobId")).map(_.stringValue())
      val extractorName = Option(message.messageAttributes().get("GiantExtractorName")).map(_.stringValue())
      TranscriptionMessageAttribute(receiveCount, messageGroupId, blobId, extractorName)
    }.toEither
  }

  private def markExternalExtractorAsComplete(id: String, extractorName: String) = {
    val result = manifest.markExternalAsComplete(id, extractorName)
    result.leftMap { failure =>
      logger.error(s"Failed to mark '${id}' processed by $extractorName as complete: ${failure.msg}")
      failure
    }
  }

  private def addDocumentTranscription(transcriptionOutput: TranscriptionOutputSuccess, transcription: TranscriptionResult) = {
    Either.catchNonFatal {
      index.addDocumentTranscription(Uri(transcriptionOutput.id), transcription)
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

  private def addDocumentTranslation(output: LlmOutputSuccess, languageData: LanguageData) = {
    Either.catchNonFatal {
      index.updateDocumentLanguageData(Uri(output.id), languageData)
        .recoverWith {
          case _ =>
            val msg = s"Failed to write language data to elasticsearch for ${output.id}"
            throw new Error(msg)
        }
      ()
    }.leftMap {
      case error => DocumentUpdateFailure.apply(error)
    }
  }

  private def parseMessage(message: Message): Either[Failure, TranscriptionOutput] = {
    val json = Json.parse(message.body())

    Json.fromJson[TranscriptionOutput](json) match {
      case JsSuccess(output, _) =>
        Right(output)

      case JsError(errors) =>
        logger.error(s"Failed to parse transcription output message: ${message.body()}, errors: ${errors.mkString(", ")}")
        Left(JsonParseFailure(errors))
    }
  }

  private def markAsFailure(uri: Uri, extractorName: String, failureMsg: String): Unit = {
    logger.error(s"Error in '${extractorName} processing ${uri}': ${failureMsg}")

    manifest.logExtractionFailure(uri, extractorName, failureMsg).left.foreach { f =>
      logger.error(s"Failed to log extractor in manifest: ${f.msg}")
    }
  }

  private def handleExternalTranscriptionOutputFailure(message: Message, id: String, extractorName: Option[String], failureMessage: String) = {
    Try {
      val sendMessageCommand = SendMessageRequest.builder()
        .queueUrl(transcribeConfig.transcriptionOutputDeadLetterQueueUrl)
        .messageBody(message.body())
        .messageGroupId(id)
        .build()
      sqsClient.sendMessage(sendMessageCommand)
      logger.info(s"moved message $id to output dead letter queue")

      sqsClient.deleteMessage(
        DeleteMessageRequest.builder()
          .queueUrl(transcribeConfig.transcriptionOutputQueueUrl)
          .receiptHandle(message.receiptHandle())
          .build()
      )
      logger.debug(s"deleted message $id")

      markAsFailure(new Uri(id), extractorName.getOrElse(classOf[ExternalTranscriptionExtractor].getSimpleName), failureMessage)
    }.toEither match {
      case Right(_) => ()
      case Left(error) => logger.error(s"failed to handle external transcript output failure message", error)
    }
  }
}
