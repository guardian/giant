package services.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.ReceiveMessageRequest
import commands.IngestFile
import controllers.api.Collections
import ingestion.phase2.IngestStorePolling
import model.Uri
import model.ingestion.{MediaDownloadOutput, RemoteIngestStatus, WorkspaceItemUploadContext}
import play.api.libs.json.Json
import services.{IngestStorage, MediaDownloadConfig, S3Config, ScratchSpace}
import services.annotations.Annotations
import services.index.Pages
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
  s3Config: S3Config,
  annotations: Annotations,
  remoteIngestStore: Neo4jRemoteIngestStore,
  remoteIngestStorage: IngestStorage,
  scratchSpace: ScratchSpace,
  manifest: Manifest,
  esEvents: services.events.Events,
  index: services.index.Index,
  pages: Pages,
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
            workspaceMetadata <- annotations.getWorkspaceMetadata(job.addedBy.username, job.workspaceId)
            _ <- remoteIngestStore.updateRemoteIngestJobStatus(parsedJob.id, RemoteIngestStatus.Ingesting)
            ingestion <- Collections.createIngestionIfNotExists(Uri(job.collection), job.ingestion, manifest, index, pages, s3Config)
            parentFolder <- annotations.addOrGetFolder(job.addedBy.username, job.workspaceId, job.parentFolderId, job.title)
            ingestFileResult <- IngestStorePolling.fetchData(job.ingestionKey, remoteIngestStorage, scratchSpace){(path, fingerprint) =>
              val collectionUri = Uri(job.collection)
              Await.result(
                new IngestFile(
                  collectionUri,
                  ingestionUri = Uri(ingestion.uri),
                  uploadId = job.id,
                  workspace = Some(WorkspaceItemUploadContext(
                    workspaceId = job.workspaceId,
                    workspaceNodeId = UUID.randomUUID().toString,
                    workspaceParentNodeId = parentFolder,
                    workspaceName = workspaceMetadata.name
                  )),
                  username = job.addedBy.username,
                  temporaryFilePath = path,
                  originalPath = Paths.get(parsedJob.metadata.map(meta => s"${meta.title}.${meta.extension}").getOrElse(job.id)),
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
            _ <- remoteIngestStore.updateRemoteIngestJobStatus(parsedJob.id, RemoteIngestStatus.Completed)
            _ <- remoteIngestStore.updateRemoteIngestJobBlobUri(parsedJob.id, ingestFileResult.blob.uri.value)
          } yield job).fold(
            failureDetail => {
              val maybeParsedJob =  messageParseResult.asOpt
              logger.error(s"Failed to ingest remote file for job with id ${maybeParsedJob.map(_.id).getOrElse(s"unknown (but had sqs id ${sqsMessage.getMessageId}")}: $failureDetail")
              // TODO: Do we care if this sending to dead letter queue fails?
              amazonSQSClient.sendMessage(config.outputDeadLetterQueueUrl, sqsMessage.getBody)
              maybeParsedJob.map(parsedJob =>
                remoteIngestStore.updateRemoteIngestJobStatus(parsedJob.id, RemoteIngestStatus.Failed)
              )
            },
            job => {
              logger.info(s"Successfully ingested remote file for job with id ${job.id} in workspace ${job.workspaceId}")
              remoteIngestStorage.delete(job.ingestionKey)
            }
        ).onComplete { _ =>
          amazonSQSClient.deleteMessage(config.outputQueueUrl, sqsMessage.getReceiptHandle)
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
