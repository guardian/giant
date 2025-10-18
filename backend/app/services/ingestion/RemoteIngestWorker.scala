package services.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.ReceiveMessageRequest
import commands.IngestFile
import controllers.api.Collections
import ingestion.phase2.IngestStorePolling
import model.{CreateIngestionResponse, Uri}
import model.annotations.WorkspaceMetadata
import model.ingestion.{FileContext, IngestionFile, RemoteIngest, RemoteIngestOutput, RemoteIngestStatus, WorkspaceItemUploadContext}
import play.api.libs.json.{JsError, JsSuccess, Json}
import services.{FingerprintServices, IngestStorage, RemoteIngestConfig, S3Config, ScratchSpace}
import services.annotations.Annotations
import services.index.Pages
import services.manifest.Manifest
import utils.Logging
import utils.attempt.{Attempt, Failure, JsonParseFailure, RemoteIngestFailure}

import java.nio.file.{Files, Path, Paths}
import java.util.UUID
import scala.concurrent.duration.DurationInt
import scala.concurrent.{Await, ExecutionContext}
import scala.jdk.CollectionConverters.CollectionHasAsScala


case class WebpageSnapshotFiles(screenshot: Path, screenshotFingerprint: Uri, html: Path, htmlFingerprint: Uri, baseFilename: String)

case class WebpageSnapshot(html: String, screenshotBase64: String, title: String)
object WebpageSnapshot {
  implicit val webpageSnapshotFormat = Json.format[WebpageSnapshot]
}

class RemoteIngestWorker(
                          amazonSQSClient: AmazonSQS,
                          config: RemoteIngestConfig,
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

  private def ingestRemoteIngestOutput(
                                        path: Path,
                                        fingerprint: Uri,
                                        job: RemoteIngest,
                                        parsedJob: RemoteIngestOutput,
                                        parentFolder: String,
                                        workspaceMetadata: WorkspaceMetadata,
                                        ingestion: CreateIngestionResponse,
                                        fileName: String) = {
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
        originalPath = Paths.get(fileName),
        lastModifiedTime = None,
        manifest = manifest,
        esEvents = esEvents,
        ingestionServices = ingestionServices,
        annotations = annotations,
        fingerPrint = Some(fingerprint.toString)
      ).process().asFuture,
      15.minutes
    )
  }

  private def getWebpageSnapshotFiles(path: Path, id: String): Either[Failure, WebpageSnapshotFiles] = {
    val fileContents = new String(java.nio.file.Files.readAllBytes(path))
    val webpageSnapshotParseResult = Json.fromJson[WebpageSnapshot](Json.parse(fileContents))
    webpageSnapshotParseResult match {
      case JsSuccess(value, _) =>
        val screenshotPath = scratchSpace.pathFor(s"$id-screenshot.jpeg")
        val htmlPath = scratchSpace.pathFor(s"$id-page.html")
        val screenshotBytes = java.util.Base64.getDecoder.decode(value.screenshotBase64)
        Files.write(screenshotPath, screenshotBytes)
        Files.write(htmlPath, value.html.getBytes)
        // sanitise title/[^a-zA-Z0-9 \-\_]/g
        val sanitisedFilename = value.title.replaceAll("[[^a-zA-Z0-9 \\-_]]", "")
        val cutFilename = sanitisedFilename.substring(0, Math.min(50, sanitisedFilename.length))
        val baseFilename = if (cutFilename.length < sanitisedFilename.length) s"${cutFilename}..." else cutFilename
        Right(
          WebpageSnapshotFiles(
            screenshotPath,
            Uri(FingerprintServices.createFingerprintFromFile(screenshotPath.toFile)),
            htmlPath,
            Uri(FingerprintServices.createFingerprintFromFile(htmlPath.toFile)),
            baseFilename
          ))
      case JsError(errors) =>
        logger.error(s"Failed to parse webpage snapshot output file at $path: $errors")
        Left(RemoteIngestFailure(s"Failed to parse webpage snapshot output file at $path: $errors"))
    }
  }

  private def processFinishedJobs(): Unit = {
    try {
      amazonSQSClient.receiveMessage(
        new ReceiveMessageRequest(config.outputQueueUrl).withMaxNumberOfMessages(10)
      ).getMessages.asScala.foreach { sqsMessage =>
        logger.info(s"Processing finished job from SQS with id ${sqsMessage.getMessageId}")

        val messageParseResult = Json.fromJson[RemoteIngestOutput](Json.parse(sqsMessage.getBody))

        (for {
          remoteIngestOutput <- Attempt.fromEither(messageParseResult.asEither.left.map(JsonParseFailure))
          _ <- Attempt.fromEither(
              if(remoteIngestOutput.status == "SUCCESS") Right(())
              else Left(RemoteIngestFailure(s"Remote ingest job ${remoteIngestOutput.id} did not complete successfully. \n$remoteIngestOutput"))
            )
          job <- remoteIngestStore.getRemoteIngestJob(remoteIngestOutput.id)
          //            task <- Attempt.fromOption(job.tasks.get(parsedJob.taskId), Attempt.Left(RemoteIngestFailure(s"No task found for job id ${parsedJob.id}")))
          workspaceMetadata <- annotations.getWorkspaceMetadata(job.addedBy.username, job.workspaceId)
          _ <- remoteIngestStore.updateRemoteIngestJobStatus(remoteIngestOutput.id, remoteIngestOutput.taskId, RemoteIngestStatus.Ingesting)
          ingestion <- Collections.createIngestionIfNotExists(Uri(job.collection), job.ingestion, manifest, index, pages, s3Config)
          parentFolder <- annotations.addOrGetFolder(job.addedBy.username, job.workspaceId, job.parentFolderId, job.title)
          _ <- IngestStorePolling.fetchData(job.taskKey(remoteIngestOutput.taskId), remoteIngestStorage, scratchSpace){ (path, fingerprint) =>
              if (remoteIngestOutput.outputType == "WEBPAGE_SNAPSHOT") {
                  for {
                    files <- getWebpageSnapshotFiles(path, job.id)
                    htmlIngest <- ingestRemoteIngestOutput(files.html, files.htmlFingerprint, job, remoteIngestOutput, parentFolder, workspaceMetadata, ingestion, s"${files.baseFilename} text")
                    screenshotIngest <- ingestRemoteIngestOutput(files.screenshot, files.screenshotFingerprint, job, remoteIngestOutput, parentFolder, workspaceMetadata, ingestion, s"${files.baseFilename} screeshot")
                  } yield {
                    Files.delete(files.html)
                    Files.delete(files.screenshot)
                    remoteIngestStore.updateRemoteIngestJobBlobUris(remoteIngestOutput.id, remoteIngestOutput.taskId, List(htmlIngest.blob.uri.value, screenshotIngest.blob.uri.value))
                  }
              } else {
                val fileName = remoteIngestOutput.metadata.map(meta => s"${meta.title}.${meta.extension}").getOrElse(s"${job.url}")
                ingestRemoteIngestOutput(path, fingerprint, job, remoteIngestOutput, parentFolder, workspaceMetadata, ingestion, fileName).map { ingestResult =>
                  remoteIngestStore.updateRemoteIngestJobBlobUris(remoteIngestOutput.id, remoteIngestOutput.taskId, List(ingestResult.blob.uri.value))
                }
              }
            }.toAttempt
          _ <- remoteIngestStore.updateRemoteIngestJobStatus(remoteIngestOutput.id, remoteIngestOutput.taskId, RemoteIngestStatus.Completed)
          } yield (job, remoteIngestOutput)).fold(
            failureDetail => {
              val maybeParsedJob =  messageParseResult.asOpt
              logger.error(
                s"Failed to ingest remote file for job with id ${maybeParsedJob.map(_.id).getOrElse(s"unknown (but had sqs id ${sqsMessage.getMessageId}")}",
                failureDetail.toThrowable
              )
              // TODO: Do we care if this sending to dead letter queue fails?
              amazonSQSClient.sendMessage(config.outputDeadLetterQueueUrl, sqsMessage.getBody)
              maybeParsedJob.map(parsedJob =>
                  remoteIngestStore.updateRemoteIngestJobStatus(parsedJob.id, parsedJob.taskId, RemoteIngestStatus.Failed)
              )
            },
          jobAndOutput => {
              logger.info(s"Successfully ingested remote file for job with id ${jobAndOutput._1.id} in workspace ${jobAndOutput._1.workspaceId}")
              remoteIngestStorage.delete(jobAndOutput._1.taskKey(jobAndOutput._2.taskId))
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
