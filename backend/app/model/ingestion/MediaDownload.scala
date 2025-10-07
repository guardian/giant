package model.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.SendMessageRequest
import model.ingestion.RemoteIngest.logger
import play.api.libs.json.{Format, Json}
import services.{IngestStorage, MediaDownloadConfig}


case class MediaDownloadJob(id: String, url: String, client: String = MediaDownloadJob.CLIENT_IDENTIFIER, outputQueueUrl: String, s3OutputSignedUrl: String)
object MediaDownloadJob {
  implicit val mediaDownloadJobFormat: Format[MediaDownloadJob] = Json.format[MediaDownloadJob]
  val CLIENT_IDENTIFIER = "EXTERNAL"

  def sendRemoteIngestJob(
    jobId: String,
    ingestionKey: Key,
    url: String,
    config: MediaDownloadConfig,
    amazonSQSClient: AmazonSQS,
    ingestStorage: IngestStorage
  ): Either[String, String] = {
    logger.info(s"Sending job with id $jobId, queue: ${config.taskQueueUrl}")
    val signedUploadUrl = ingestStorage.getUploadSignedUrl(ingestionKey).getOrElse(throw new Exception(s"Failed to get signed upload URL for job $jobId"))
    val mediaDownloadJob = MediaDownloadJob(jobId, url, MediaDownloadJob.CLIENT_IDENTIFIER, config.outputQueueUrl, signedUploadUrl)
    val jobJson = Json.stringify(Json.toJson(mediaDownloadJob))
    val sendMessageRequest = new SendMessageRequest()
      .withQueueUrl(config.taskQueueUrl)
      .withMessageBody(jobJson)
    try {
      amazonSQSClient.sendMessage(sendMessageRequest)
      Right(jobId)
    } catch {
      case e: Exception =>
        val msg = s"Failed to send job with id $jobId to SQS"
        logger.error(s"$msg: ${e.getMessage}", e)
        Left(msg)
    }
  }
}

case class MediaDownloadOutputMetadata(title: String, extension: String, mediaPath: String, duration: Int)
case class MediaDownloadOutput(id: String, status: String, metadata: Option[MediaDownloadOutputMetadata])
object MediaDownloadOutput {
  implicit val mediaDownloadOutputMetadataFormat: Format[MediaDownloadOutputMetadata] = Json.format[MediaDownloadOutputMetadata]
  implicit val mediaDownloadOutputFormat: Format[MediaDownloadOutput] = Json.format[MediaDownloadOutput]
}
