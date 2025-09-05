package services.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.ReceiveMessageRequest
import model.ingestion.{MediaDownloadJob, MediaDownloadOutput}
import play.api.libs.json.Json
import services.manifest.Neo4jRemoteIngestManifest
import services.{MediaDownloadConfig, S3IngestStorage}
import utils.Logging

import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.CollectionHasAsScala
class RemoteIngestWorker(
                          remoteIngestManifest: Neo4jRemoteIngestManifest,
                          amazonSQSClient: AmazonSQS,
                          ingestStorage: S3IngestStorage,
                          config: MediaDownloadConfig)(implicit executionContext: ExecutionContext) extends Logging  {

  private def startPendingJobs(): Unit = {
    for {
      jobs <- remoteIngestManifest.getRemoteIngestJobs(Some("pending"))
    } yield {
      jobs.foreach { job =>
        logger.info(s"Sending job with id ${job.id}, queue: ${config.taskQueueUrl}")
        val signedUploadUrl = ingestStorage.getUploadSignedUrl(job.id).getOrElse(throw new Exception(s"Failed to get signed upload URL for job ${job.id}"))
        val mediaDownloadJob = MediaDownloadJob(job.id, job.url, MediaDownloadJob.CLIENT_IDENTIFIER, config.outputQueueUrl, signedUploadUrl)
        val jobJson = Json.stringify(Json.toJson(mediaDownloadJob))
        try {
          remoteIngestManifest.updateRemoteIngestJobStatus(job.id, "started")
          amazonSQSClient.sendMessage(config.taskQueueUrl, jobJson)
        } catch {
          case e: Exception =>
            logger.info(s"Failed to send job with id ${job.id} to SQS: ${e.getMessage}", e)
        }
      }
    }
  }
  private def processFinishedJobs(): Unit = {
    try {
      val finishedJobs = amazonSQSClient.receiveMessage(new ReceiveMessageRequest(config.outputQueueUrl)
        .withMaxNumberOfMessages(10)).getMessages.asScala

      finishedJobs.foreach { job =>
        logger.info(s"Processing finished job from SQS with id ${job.getMessageId}")

        Json.fromJson[MediaDownloadOutput](Json.parse(job.getBody)).asEither match {
          case Right(parsedJob) =>
            // TODO: Implement ingestion of the file. For now, just delete the finished job from the queue
            logger.info(s"Fetched remote ingest job status with id ${parsedJob.id} and status ${parsedJob.status}")
            amazonSQSClient.deleteMessage(config.outputQueueUrl, job.getReceiptHandle)
          case Left(errors) =>
            logger.error(s"Failed to parse finished job from SQS with id ${job.getMessageId}: ${errors}")
            amazonSQSClient.deleteMessage(config.outputQueueUrl, job.getReceiptHandle)
        }
      }
    } catch  {
      case e: Exception =>
        logger.error(s"Failed to process finished jobs from SQS: ${e.getMessage}", e)
    }

  }

  def start(): Unit = {
    logger.info("Starting Remote Ingest Worker cycle")
    startPendingJobs()
    processFinishedJobs()
  }

}
