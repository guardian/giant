package services.ingestion

import com.amazonaws.services.sqs.AmazonSQS
import com.amazonaws.services.sqs.model.ReceiveMessageRequest
import commands.IngestFile
import model.Uri
import model.ingestion.{MediaDownloadJob, MediaDownloadOutput}
import play.api.libs.json.{JsError, JsSuccess, Json}
import services.annotations.Neo4jAnnotations
import services.observability.PostgresClient
import services.{MediaDownloadConfig, S3IngestStorage}

import java.nio.file.Paths
import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters.CollectionHasAsScala
import scala.util.{Failure, Success, Try}

class RemoteIngestWorker(postgresClient: PostgresClient, amazonSQSClient: AmazonSQS, ingestStorage: S3IngestStorage, config: MediaDownloadConfig, annotations: Neo4jAnnotations)(implicit executionContext: ExecutionContext)  {

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
      Try {
        val json = Json.parse(job.getBody)
        Json.fromJson[MediaDownloadOutput](json) match {
          case JsSuccess(value, _) => value
          case JsError(errors) => throw new Exception(s"Failed to parse media download output: $errors")
        }
      } match {
        case Success(parsedJob) =>
          println(s"Parsed job with id ${parsedJob.id} and status ${parsedJob.status}")
          postgresClient.updateRemoteIngestJobStatus(parsedJob.id, "INGESTING")
          val dbJob = postgresClient.getRemoteIngestJob(parsedJob.id).map { maybeJob =>
            val workspace = annotations.getWorkspaceMetadata(parsedJob.user, parsedJob.id)
            maybeJob.map {j =>
              new IngestFile(
                Uri(j.collection),
                Uri(j.collection).chain(j.ingestion),
                j.id,
                workspace = maybeWorkspaceContext,
                req.user.username,
                temporaryFilePath = req.body.path,
                originalPath = Paths.get(originalPath),
                lastModifiedTime,
                manifest, esEvents, ingestionServices, annotations, fingerprint
              ).process().map { result =>
                Created(Json.toJson(result))
              }
            }

          }


        case Failure(exception) =>
          println(s"Failed to parse job with id ${job.getMessageId}: ${exception.getMessage}")
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
