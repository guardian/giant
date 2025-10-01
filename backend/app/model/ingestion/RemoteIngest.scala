package model.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.SendMessageRequest
import org.joda.time.DateTime
import play.api.libs.json.Json
import services.ingestion.RemoteIngestStore
import services.{IngestStorage, MediaDownloadConfig}
import services.observability.JodaReadWrites
import utils.Logging

case class RemoteIngest(
                         id: String,
                         title: String,
                         status: String,
                         workspaceId: String,
                         parentFolderId: String,
                         collection: String,
                         ingestion: String,
                         timeoutAt: DateTime,
                         url: String,
                         userEmail: String,
                         blobUri: Option[String] = None)

object RemoteIngest extends Logging {
  implicit val dateWrites = JodaReadWrites.dateWrites
  implicit val dateReads = JodaReadWrites.dateReads
  implicit val remoteIngestFormat = Json.format[RemoteIngest]


  def sendRemoteIngestJob(job: RemoteIngest, config: MediaDownloadConfig, amazonSQSClient: AmazonSQS, ingestStorage: IngestStorage): Either[String, String] = {
    logger.info(s"Sending job with id ${job.id}, queue: ${config.taskQueueUrl}")
    val signedUploadUrl = ingestStorage.getUploadSignedUrl(job.id).getOrElse(throw new Exception(s"Failed to get signed upload URL for job ${job.id}"))
    val mediaDownloadJob = MediaDownloadJob(job.id, job.url, MediaDownloadJob.CLIENT_IDENTIFIER, config.outputQueueUrl, signedUploadUrl)
    val jobJson = Json.stringify(Json.toJson(mediaDownloadJob))
    val sendMessageRequest = new SendMessageRequest()
      .withQueueUrl(config.taskQueueUrl)
      .withMessageBody(jobJson)
      .withMessageGroupId(job.id)
    try {
      amazonSQSClient.sendMessage(sendMessageRequest)
      Right(job.id)
    } catch {
      case e: Exception =>
        val msg = s"Failed to send job with id ${job.id} to SQS"
        logger.error(s"$msg: ${e.getMessage}", e)
        Left(msg)
    }
  }
}
