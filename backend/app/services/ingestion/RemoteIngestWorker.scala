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
                          amazonSQSClient: AmazonSQS,
                          config: MediaDownloadConfig)(implicit executionContext: ExecutionContext) extends Logging  {

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
    processFinishedJobs()
  }

}
