package extraction

import model.TranscriptionMessageAttributes
import model.manifest.Blob
import play.api.libs.json.{Json, Writes}
import software.amazon.awssdk.services.sqs.SqsClient
import software.amazon.awssdk.services.sqs.model.{MessageAttributeValue, SendMessageRequest}
import utils.Logging
import utils.attempt.{Failure, SQSSendMessageFailure}

import java.util.UUID
import java.io.InputStream
import scala.jdk.CollectionConverters.MapHasAsJava

/**
  * External Extractors are where the actual extraction doesn't take place on the worker but in some third party service
  * The behaviour is a little different as we need to trigger the extraction, then the worker can get on with other tasks
  * whilst waiting for a response from the third party service. Once the response comes in we need to store the data
  * and update the manifest to mark the extraction as complete
  */
abstract class ExternalExtractor extends Extractor with Logging {

  override def external = true

  final override def extract(blob: Blob, inputStream: InputStream, params: ExtractionParams): Either[Failure, Unit] = {
   triggerExtraction(blob, params)
  }

  def triggerExtraction(blob: Blob, params: ExtractionParams): Either[Failure, Unit]

  // giant doesn't care about the cost of external extractors because another service handles it, so set this low
  def cost(mimeType: String, size: Long): Long = 10

  protected def sendToQueue[T: Writes](sqsClient: SqsClient, queueUrl: String, job: T, blobUri: String, extractorName: String): Either[Failure, Unit] = {
    try {
      logger.info(s"sending message to Transcription Service Queue")
      val messageRequest = SendMessageRequest.builder()
        .queueUrl(queueUrl)
        .messageBody(Json.stringify(Json.toJson(job)))
        .messageGroupId(UUID.randomUUID().toString)
        // these attributes should be returned unchanged by the transcription service so we can match the response to the original extractor
        .messageAttributes(Map(
          TranscriptionMessageAttributes.GIANT_BLOB_URI -> MessageAttributeValue.builder().dataType("String").stringValue(blobUri).build(),
          TranscriptionMessageAttributes.GIANT_EXTRACTOR_NAME -> MessageAttributeValue.builder().dataType("String").stringValue(extractorName).build()
        ).asJava)
        .build()
      sqsClient.sendMessage(messageRequest)
      Right(())
    } catch {
      case e: Throwable => Left(SQSSendMessageFailure(e.getMessage))
    }
  }
}
