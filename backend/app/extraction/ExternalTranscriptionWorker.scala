package extraction

import cats.syntax.either._
import model.index.TranslationData
import software.amazon.awssdk.services.sqs.SqsClient
import software.amazon.awssdk.services.sqs.model.{DeleteMessageRequest, Message, MessageSystemAttributeName, ReceiveMessageRequest, SendMessageRequest}
import model.{Language, Languages, LlmOutputFailure, LlmOutputSuccess, OcrOutputFailure, OcrOutputSuccess, TranscriptionMessageAttributes, TranscriptionOutput, TranscriptionOutputFailure, TranscriptionOutputSuccess, TranscriptionResult, TranslationField, Uri}
import play.api.libs.json.{JsError, JsSuccess, Json}
import services.index.{Index, IndexFields}
import services.manifest.{Manifest, WorkerManifest}
import services.{ObjectStorage, ScratchSpace, TranscribeConfig}
import services.index.Pages
import services.ingestion.IngestionServices
import extraction.ocr.{BaseOcrExtractor, OcrMyPdfExtractor}
import com.gu.transcriptionservice.workerinterface.OcrOutput
import org.apache.commons.io.FileUtils

import java.nio.file.{Files, Path}
import java.util.Base64
import scala.util.Using
import utils.Logging
import utils.attempt.{Attempt, DocumentUpdateFailure, ExternalPdfOutputParsingError, ExternalTranscriptionOutputFailure, Failure, JsonParseFailure, OcrMyPdfPostProcessFailure, UnknownFailure}
import TranscriptionOutput.transcriptionOutputReads
import extraction.ExternalTranscriptionWorker.markExternalExtractorAsComplete

import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.CollectionHasAsScala
import scala.util.Try

case class TranscriptionMessageAttribute(receiveCount: Option[Int], messageGroupId: String, blobUri: Option[String], extractorName: Option[String], ingestion: Option[String])

class ExternalTranscriptionWorker(manifest: Manifest, sqsClient: SqsClient, transcribeConfig: TranscribeConfig, blobStorage: ObjectStorage, index: Index,
                                  scratch: ScratchSpace, pageService: Pages, previewStorage: ObjectStorage, ingestionServices: IngestionServices)(implicit executionContext: ExecutionContext)  extends Logging{

  private val MAX_RECEIVE_COUNT = 3

  def pollForResults(): Int  = {
    logger.info(s"Fetching messages from external transcription output queue ${transcribeConfig.transcriptionOutputQueueUrl}")

    val messages = sqsClient.receiveMessage(ReceiveMessageRequest.builder()
        .queueUrl(transcribeConfig.transcriptionOutputQueueUrl)
        .maxNumberOfMessages(10)
        .messageSystemAttributeNames(MessageSystemAttributeName.MESSAGE_GROUP_ID, MessageSystemAttributeName.APPROXIMATE_RECEIVE_COUNT)
        // request the custom attributes that the transcription worker preserves from the original job so that we can
        // match the output back to the relevant blob/extractor
        .messageAttributeNames(TranscriptionMessageAttributes.GIANT_BLOB_URI, TranscriptionMessageAttributes.GIANT_EXTRACTOR_NAME, TranscriptionMessageAttributes.GIANT_INGESTION)
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
      parsedMessage match {
        case output: TranscriptionOutputSuccess => for {
          transcripts <- getTranscripts(output)
          _ <- addDocumentTranscription(output, transcripts)
          _ <- markExternalExtractorAsComplete(manifest, output.id, classOf[ExternalTranscriptionExtractor].getSimpleName)
        } yield {
          logger.info(s"Transcript job ${output.id} processed successfully")
        }
        case output: TranscriptionOutputFailure =>
          if (output.noAudioDetected) {
            logger.info(s"No audio detected in job ${output.id}")
            markExternalExtractorAsComplete(manifest, output.id, classOf[ExternalTranscriptionExtractor].getSimpleName)
          } else {
            Left(ExternalTranscriptionOutputFailure.apply(s"External transcription service failed to transcribe the file ${output.originalFilename}"))
          }
        case output: LlmOutputSuccess =>
          logger.info(s"Processing LLM job ${output.id} with output key ${output.outputKey} and extractor name ${messageAttributes.extractorName.getOrElse("unknown")}")
          messageAttributes.extractorName match {
            case Some(extractorName) =>
              for {
                languageData <- getLlmTranslationOutput(output)
                _ <- addDocumentTranslation(output, languageData)
                _ <- markExternalExtractorAsComplete(manifest, output.id, extractorName)
              } yield {
                logger.info(s"LLM job ${output.id} for extractor ${extractorName} processed successfully")
              }
            case None =>
              Left(ExternalTranscriptionOutputFailure.apply(s"LLM output message for ${output.id} is missing the GiantExtractorName message attribute, cannot determine which extractor to mark as complete"))
          }
        case output: OcrOutputSuccess =>
          (messageAttributes.extractorName, messageAttributes.ingestion) match {
            case (Some(extractorName), Some(ingestion)) if extractorName == classOf[ExternalOcrMyPdfExtractor].getSimpleName =>
              for {
                _ <- processOcrOutput(output, extractorName, ingestion)
                _ <- markExternalExtractorAsComplete(manifest, output.id, extractorName)
              } yield ()
            case _ => Left(ExternalTranscriptionOutputFailure(s"OCR output for ${output.id} has a missing or unsupported extractor name or a missing ingestion"))
          }
        case output: OcrOutputFailure =>
          Left(ExternalTranscriptionOutputFailure(s"External transcription service failed to OCR the file ${output.id}"))
        case output: LlmOutputFailure =>
          Left(ExternalTranscriptionOutputFailure.apply(s"External transcription service failed to translate the file ${output.id}"))
      }
    }

    result match {
      case Right(_) =>
        // Acknowledge only after storing the results and updating the manifest, so failures can be retried.
        sqsClient.deleteMessage(DeleteMessageRequest.builder()
          .queueUrl(transcribeConfig.transcriptionOutputQueueUrl)
          .receiptHandle(message.receiptHandle()).build())
        completed + 1
      case Left(failure: ExternalTranscriptionOutputFailure) =>
        logger.error(failure.msg, failure.toThrowable)
        handleExternalTranscriptionOutputFailure(message, messageAttributes, failure.msg)
        completed + 1
      case Left(failure) =>
        logger.error(s"failed to process sqs message", failure.toThrowable)
        if (messageAttributes.receiveCount.exists(_ >= MAX_RECEIVE_COUNT)) {
          markAsFailure(messageAttributes, failure.msg)
        }
        completed
    }
  }

  private def writePdfData(ocrOutput: OcrOutput, tmpDir: Path) = {
    require(ocrOutput.ocrData.map(_.language).distinct.size == ocrOutput.ocrData.size, "Duplicate OCR output languages")
    // write bas64 encoded pdfs to tmpDir
    val pdfPaths: Map[Language, Path] = ocrOutput.ocrData.zipWithIndex.map { case (data, index) =>
      val language = Languages.all.find(_.ocr == data.language).getOrElse {
        throw new IllegalArgumentException(s"Unknown OCR language ${data.language}")
      }
      val path = tmpDir.resolve(s"$index.pdf")
      Files.write(path, Base64.getMimeDecoder.decode(data.pdfBase64))
      language -> path
    }.toMap
    pdfPaths
  }

  private def processOcrOutput(output: OcrOutputSuccess, extractorName: String, ingestion: String): Either[Failure, Unit] = {
    val tmpDir = scratch.createWorkingDir(s"external-ocr-output-${output.id}")
    try {
      for {
        stream <- blobStorage.get(output.outputKey)
        ocrOutput <- Try(Using.resource(stream)(input => Json.parse(input).as[OcrOutput])).toEither.leftMap(UnknownFailure(_))
        // we need to get details of the original ingestion from neo4j as it's needed in postProcessPdf to add a translation TODO
        // if the document is detected to not be in english
        pdfPaths <- Either.catchNonFatal(writePdfData(ocrOutput, tmpDir)).leftMap(ExternalPdfOutputParsingError(_))
        textByLanguage <- Either.catchNonFatal {
          OcrMyPdfExtractor.postProcessPdf(pdfPaths, Uri(output.id), pageService, previewStorage, index)
        }.leftMap(OcrMyPdfPostProcessFailure(_))
        workItems <- manifest.getActiveExternalWorkForBlob(Uri(output.id), extractorName, ingestion)
      } yield {
        // Work items is a list which is unlikely to have more than one item, but could if: a user uploaded the same file
        // twice in different directories using the 'upload directory' function (with the upload files function, we
        // randomly drop one of the duplicates, which is a different bug)
        // it shouldn't happen via the cli as we always check if the blob exists first
        // with that in mind, we're just going to take the first work item here and use that to trigger translation
        // this would mean that in the workspace view, only one of the duplicate uploads would appear to be processing whilst
        // the translation takes place (but the translation would still be added to the blob)
        workItems.headOption.foreach { item =>
          val params = ExtractionParams(item.ingestion, pdfPaths.keys.toList, item.parentBlobs, item.workspace)
          BaseOcrExtractor.handleOcrTranslation(item.blob.uri, textByLanguage, index, ingestionServices, params)
        }
      }
    } finally {
    FileUtils.deleteDirectory(tmpDir.toFile)
  }
  }

  private def getLlmTranslationOutput(llmOutput: LlmOutputSuccess): Either[Failure, List[TranslationField]] = {
    val llmOutputText = blobStorage.getGzippedText(llmOutput.outputKey)

    llmOutputText.flatMap { output =>
      Try(Json.parse(output)).toEither.leftMap { error =>
        logger.error(s"Failed to parse LLM output as JSON for ${llmOutput.id}. Raw output: $output", error)
        UnknownFailure(error)
      }.flatMap { json =>
        Json.fromJson[List[TranslationField]](json).asEither.leftMap { errors =>
          logger.error(s"Failed to deserialize LLM output to LanguageData for ${llmOutput.id}. JSON: $output")
          JsonParseFailure(errors)
        }
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
      val blobId = Option(message.messageAttributes().get(TranscriptionMessageAttributes.GIANT_BLOB_URI)).map(_.stringValue())
      val extractorName = Option(message.messageAttributes().get(TranscriptionMessageAttributes.GIANT_EXTRACTOR_NAME)).map(_.stringValue())
      val ingestion = Option(message.messageAttributes().get(TranscriptionMessageAttributes.GIANT_INGESTION)).map(_.stringValue())
      TranscriptionMessageAttribute(receiveCount, messageGroupId, blobId, extractorName, ingestion)
    }.toEither
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

  // we shouldn't trust arbitrary field names we read from SQS
  private def discardInvalidFields(fields: List[TranslationField]): List[TranslationField] = {
    val validFields = List(
      IndexFields.translationData.textField,
      IndexFields.translationData.emailBodyField,
      IndexFields.translationData.emailSubjectField,
      IndexFields.translationData.ocr
    )

    fields.filter(field => validFields.contains(field.name))
  }

  private def addDocumentTranslation(output: LlmOutputSuccess, fields: List[TranslationField]): Either[Failure, Unit] = {
    logger.info(s"Adding translation field for ${output.id} with fields ${fields.map(_.name).mkString(", ")}")
    val result = discardInvalidFields(fields).map{ field =>
      Either.catchNonFatal {
        index.addTranslationToLanguageData(Uri(output.id), field.name, field.text)
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

    // convert List of eithers into single Either that is a Left if any of the eithers is a Left
    result.collectFirst { case Left(err) => err } match {
      case Some(err) => Left(err)
      case None => Right(())
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

  private def markAsFailure(messageAttributes: TranscriptionMessageAttribute, failureMsg: String): Unit = {
    logger.error(s"Error in '${messageAttributes.extractorName} processing ${messageAttributes.blobUri}', group id ${messageAttributes.messageGroupId}: ${failureMsg}")

    if (messageAttributes.extractorName.isEmpty || messageAttributes.blobUri.isEmpty) {
      logger.error(s"Can't mark failure as extractor name or uri missing from extracted message attributes.")
    }
    for {
      name <- messageAttributes.extractorName
      blobUri <- messageAttributes.blobUri
    } yield {
      manifest.logExtractionFailure(new Uri(blobUri), name, failureMsg).left.foreach { f =>
        logger.error(s"Failed to log extractor in manifest: ${f.msg}")
      }
    }
  }

  private def handleExternalTranscriptionOutputFailure(message: Message, messageAttributes: TranscriptionMessageAttribute, failureMessage: String): Unit  = {
    Try {
      val sendMessageCommand = SendMessageRequest.builder()
        .queueUrl(transcribeConfig.transcriptionOutputDeadLetterQueueUrl)
        .messageBody(message.body())
        .messageAttributes(message.messageAttributes())
        .messageGroupId(messageAttributes.messageGroupId)
        .build()
      sqsClient.sendMessage(sendMessageCommand)
      logger.info(s"moved message ${messageAttributes.messageGroupId} to output dead letter queue")

      sqsClient.deleteMessage(
        DeleteMessageRequest.builder()
          .queueUrl(transcribeConfig.transcriptionOutputQueueUrl)
          .receiptHandle(message.receiptHandle())
          .build()
      )
      logger.debug(s"deleted message ${messageAttributes.messageGroupId}")


      markAsFailure(messageAttributes, failureMessage)

    }.toEither match {
      case Right(_) => ()
      case Left(error) => logger.error(s"failed to handle external transcript output failure message", error)
    }
  }
}

object ExternalTranscriptionWorker extends Logging {
  def markExternalExtractorAsComplete(manifest: WorkerManifest, id: String, extractorName: String): Either[Failure, Unit] = {
    val result = manifest.markExternalAsComplete(id, extractorName)
    result.leftMap { failure =>
      logger.error(s"Failed to mark '${id}' processed by $extractorName as complete: ${failure.msg}")
      failure
    }
  }
}
