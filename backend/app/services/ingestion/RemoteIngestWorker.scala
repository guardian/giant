package services.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.ReceiveMessageRequest
import commands.IngestFile
import ingestion.phase2.IngestStorePolling
import model.Uri
import model.ingestion.{MediaDownloadOutput, WorkspaceItemUploadContext}
import play.api.libs.json.Json
import services.MediaDownloadConfig
import services.annotations.Annotations
import services.manifest.Manifest
import utils.Logging
import utils.attempt.{Attempt, JsonParseFailure, RemoteIngestFailure}

import java.nio.file.Paths
import java.util.UUID
import scala.concurrent.duration.DurationInt
import scala.concurrent.{Await, ExecutionContext}
import scala.jdk.CollectionConverters.CollectionHasAsScala

class RemoteIngestWorker(
  amazonSQSClient: AmazonSQS,
  config: MediaDownloadConfig,
  annotations: Annotations,
  remoteIngestStore: Neo4jRemoteIngestStore,
  ingestStorePolling: IngestStorePolling,
  manifest: Manifest,
  esEvents: services.events.Events,
  ingestionServices: IngestionServices
)(implicit executionContext: ExecutionContext) extends Logging  {

  private def processFinishedJobs(): Unit = {
    try {
      amazonSQSClient.receiveMessage(
        new ReceiveMessageRequest(config.outputQueueUrl).withMaxNumberOfMessages(10)
      ).getMessages.asScala.foreach { sqsMessage =>
        logger.info(s"Processing finished job from SQS with id ${sqsMessage.getMessageId}")

        val messageParseResult = Json.fromJson[MediaDownloadOutput](Json.parse(sqsMessage.getBody))

        (for {
            parsedJob <- Attempt.fromEither(messageParseResult.asEither.left.map(JsonParseFailure))
            _ <- Attempt.fromEither(
              if(parsedJob.status == "SUCCESS") Right(())
              else Left(RemoteIngestFailure(s"Remote ingest job ${parsedJob.id} did not complete successfully. \n$parsedJob"))
            )
            job <- remoteIngestStore.getRemoteIngestJob(parsedJob.id)
            workspaceMetadata <- annotations.getWorkspaceMetadata(job.userEmail, job.workspaceId)
            _ <- remoteIngestStore.updateRemoteIngestJobStatus(parsedJob.id, "INGESTING")
            ingestFileResult <- ingestStorePolling.fetchData(job.ingestionKey){(path, fingerprint) =>
              val collectionUri = Uri(job.collection)
              Await.result(
                new IngestFile(
                  collectionUri,
                  ingestionUri = collectionUri.chain(job.ingestion),
                  uploadId = job.id,
                  workspace = Some(WorkspaceItemUploadContext(
                    workspaceId = job.workspaceId,
                    workspaceNodeId = UUID.randomUUID().toString,
                    workspaceParentNodeId = job.parentFolderId,
                    workspaceName = workspaceMetadata.name
                  )),
                  username = job.userEmail,
                  temporaryFilePath = path,
                  originalPath = Paths.get(s"${job.title}/${parsedJob.metadata.map(meta => s"${meta.title}.${meta.extension}").getOrElse(job.id)}"),
                  lastModifiedTime = None,
                  manifest = manifest,
                  esEvents = esEvents,
                  ingestionServices = ingestionServices,
                  annotations = annotations,
                  fingerPrint = Some(fingerprint.toString)
                ).process().asFuture,
                15.minutes
              )
            }.toAttempt
            _ <- remoteIngestStore.updateRemoteIngestJobStatus(parsedJob.id, "COMPLETED"/*, ingestFileResult.blob.uri TODO store blob uri on success */)
          } yield job).fold(
            failureDetail => {
              val maybeParsedJob =  messageParseResult.asOpt
              logger.error(s"Failed to ingest remote file for job with id ${maybeParsedJob.map(_.id).getOrElse(s"unknown (but had sqs id ${sqsMessage.getMessageId}")}: $failureDetail")
              maybeParsedJob.map(parsedJob =>
                remoteIngestStore.updateRemoteIngestJobStatus(parsedJob.id, "FAILED")
              )
            },
            job => logger.info(s"Successfully ingested remote file for job with id ${job.id} in workspace ${job.workspaceId}")
        ).onComplete(_ =>
          amazonSQSClient.deleteMessage(config.outputQueueUrl, sqsMessage.getReceiptHandle)
        )
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
