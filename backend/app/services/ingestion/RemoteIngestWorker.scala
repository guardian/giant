package services.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.ReceiveMessageRequest
import model.ingestion.{MediaDownloadJob, MediaDownloadOutput}
import play.api.libs.json.Json
import services.observability.PostgresClient
import services.{MediaDownloadConfig, S3IngestStorage}
import utils.Logging

import scala.jdk.CollectionConverters.CollectionHasAsScala
class RemoteIngestWorker(
                          postgresClient: PostgresClient,
                          amazonSQSClient: AmazonSQS,
                          ingestStorage: S3IngestStorage,
                          config: MediaDownloadConfig) extends Logging  {

  private def startPendingJobs(): Unit = {
    for {
      jobs <- postgresClient.getRemoteIngestJobs(Some("pending"))
    } yield {
      jobs.foreach { job =>
        logger.info(s"Sending job with id ${job.id}, json $jobJson, queue: ${config.taskQueueUrl}")
        val signedUploadUrl = ingestStorage.getUploadSignedUrl(job.id).getOrElse(throw new Exception(s"Failed to get signed upload URL for job ${job.id}"))
        val mediaDownloadJob = MediaDownloadJob(job.id, job.url, "EXTERNAL", config.outputQueueUrl, signedUploadUrl)
        val jobJson = Json.stringify(Json.toJson(mediaDownloadJob))
        try {
          postgresClient.updateRemoteIngestJobStatus(job.id, "started")
          amazonSQSClient.sendMessage(config.taskQueueUrl, jobJson)
        } catch {
          case e: Exception =>
            logger.info(s"Failed to send job with id ${job.id} to SQS: ${e.getMessage}", e)
        }
      }
    }
  }
  private def processFinishedJobs(): Unit = {
    val finishedJobs = amazonSQSClient.receiveMessage(new ReceiveMessageRequest(config.outputQueueUrl)
      .withMaxNumberOfMessages(10)).getMessages.asScala

    finishedJobs.foreach { job =>

      for {
        parsedJob <- Json.fromJson[MediaDownloadOutput](Json.parse(job.getBody)).asEither
      } yield {
        // TODO: Implement ingestion of the file. For now, just delete the finished job from the queue
        logger.info(s"Fetched remote ingest job status with id ${parsedJob.id} and status ${parsedJob.status}")
        amazonSQSClient.deleteMessage(config.outputQueueUrl, job.getReceiptHandle)
      }
    }
  }

  def start(): Unit = {
    startPendingJobs()
    processFinishedJobs()
  }

}
