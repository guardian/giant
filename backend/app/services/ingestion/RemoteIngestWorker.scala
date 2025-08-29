package services.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.ReceiveMessageRequest
import commands.IngestFile
import ingestion.phase2.IngestStorePolling
import model.Uri
import model.ingestion.{MediaDownloadJob, MediaDownloadOutput, WorkspaceItemUploadContext}
import org.apache.pekko.http.scaladsl.model.DateTime
import play.api.libs.json.{JsError, JsSuccess, Json}
import services.annotations.Annotations
import services.index.Pages
import services.observability.PostgresClient
import services.{MediaDownloadConfig, S3IngestStorage, ScratchSpace}
import services.manifest.Manifest
import services.users.UserManagement
import utils.auth.providers.UserProvider

import java.nio.file.Paths
import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.CollectionHasAsScala
import scala.util.{Failure, Success, Try}

class RemoteIngestWorker(
                          postgresClient: PostgresClient,
                          amazonSQSClient: AmazonSQS,
                          ingestStorage: S3IngestStorage,
                          ingestStorePolling: IngestStorePolling,
                          config: MediaDownloadConfig,
                          annotations: Annotations,
                          manifest: Manifest,
                          users: UserManagement,
                          esEvents: services.events.Events,
                          pages: Pages,
                          scratchSpace: ScratchSpace,
                          ingestionServices: IngestionServices)(implicit executionContext: ExecutionContext)  {

  private def startPendingJobs(): Unit = {
    println("Starting remote ingest jobs")
    for {
      jobs <- postgresClient.getRemoteIngestJobs(Some("pending"))
    } yield {
      println(jobs)
      jobs.foreach { job =>
        val signedUploadUrl = ingestStorage.getUploadSignedUrl(job.id).getOrElse(throw new Exception(s"Failed to get signed upload URL for job ${job.id}"))
        val mediaDownloadJob = MediaDownloadJob(job.id, job.url, "EXTERNAL", config.outputQueueUrl, signedUploadUrl)
        // Convert the job to a JSON string
        val jobJson = Json.stringify(Json.toJson(mediaDownloadJob))
        println(s"Sending job with id ${job.id}, json $jobJson, queue: ${config.taskQueueUrl}")
        try {
          postgresClient.updateRemoteIngestJobStatus(job.id, "started")
          amazonSQSClient.sendMessage(config.taskQueueUrl, jobJson)
        } catch {
          case e: Exception =>
            println(s"Failed to send job with id ${job.id} to SQS: ${e.getMessage}")
            // Optionally, you can update the job status to failed in the database
          //          postgresClient.updateRemoteIngestJobStatus(job.id, "failed")
        }
      }
    }
  }

  private def getFinishedJobs(): Unit = {
    println("Fetching completed remote ingest jobs")
    val finishedJobs = amazonSQSClient.receiveMessage(new ReceiveMessageRequest(config.outputQueueUrl)
      .withMaxNumberOfMessages(10)).getMessages.asScala

    finishedJobs.foreach{ job =>

      for {
        parsedJob <- Json.fromJson[MediaDownloadOutput](Json.parse(job.getBody)).asEither
        job <- postgresClient.getRemoteIngestJob(parsedJob.id)
        workspace <- annotations.getWorkspaceMetadata(job.userEmail, job.workspaceId)
      } yield {
        if (parsedJob.status == "SUCCESS") {
          postgresClient.updateRemoteIngestJobStatus(parsedJob.id, "INGESTING")
          val workspaceContext = WorkspaceItemUploadContext(job.workspaceId, job.workspaceNodeId, job.parentFolderId, workspace.name)
          ingestStorePolling.fetchData(job.id, scratchSpace.createWorkingDir(job.id)){
            case (path, fingerprint) =>
              new IngestFile(
                collectionUri = Uri(job.collection),
                ingestionUri = Uri(job.collection).chain(job.ingestion),
                uploadId = job.id,
                workspace = Some(workspaceContext),
                username = job.userEmail,
                temporaryFilePath = path,
                originalPath = parsedJob.metadata.map(metadata => Paths.get(s"${metadata.title}.${metadata.extension}")).getOrElse(Paths.get(job.id)),
                lastModifiedTime = None,
                manifest = manifest,
                esEvents = esEvents,
                ingestionServices = ingestionServices,
                annotations = annotations,
                fingerPrint = Some(fingerprint.value)
              ).process()

          }

        }
    }
    val parsedJobs = finishedJobs.map(message => Json.fromJson[MediaDownloadOutput](Json.parse(message.getBody)))
    println(parsedJobs)
    parsedJobs.foreach{ job =>
      val j = postgresClient.getRemoteIngestJob(job.id)
    }
    //getRemoteIngestJob


  }

  def start(): Unit = {
    startPendingJobs()
    getFinishedJobs()
  }

}
