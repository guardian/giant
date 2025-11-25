package model.ingestion

import model.frontend.user.PartialUser
import software.amazon.awssdk.services.sns.SnsClient
import software.amazon.awssdk.services.sns.model.PublishRequest
import org.joda.time.DateTime
import play.api.libs.json.{Format, JsError, JsResult, JsString, JsSuccess, JsValue, Json, OFormat, Reads, Writes}
import services.observability.JodaReadWrites
import services.{IngestStorage, RemoteIngestConfig}
import utils.Logging
import org.neo4j.driver.v1.Value

import java.nio.file.Path
import java.util.UUID
import scala.jdk.CollectionConverters.CollectionHasAsScala

object RemoteIngestStatus extends Enumeration {
  type RemoteIngestStatus = Value
  val Queued, Ingesting, Completed, Failed, TimedOut  = Value

  implicit val format: Format[RemoteIngestStatus] = new Format[RemoteIngestStatus] {
    def writes(status: RemoteIngestStatus): JsValue = JsString(status.toString)
    def reads(json: JsValue): JsResult[RemoteIngestStatus] = json match {
      case JsString(s) =>
        values.find(_.toString == s)
          .map(JsSuccess(_))
          .getOrElse(JsError(s"Unknown RemoteIngestStatus: $s"))
      case _ => JsError("String value expected for RemoteIngestStatus")
    }
  }
}

case class RemoteIngestTask(id: String, status: RemoteIngestStatus.RemoteIngestStatus, blobUris: List[String])
object RemoteIngestTask {
  implicit val remoteIngestTaskFormat: OFormat[RemoteIngestTask] = Json.format[RemoteIngestTask]

  def fromNeo4jValue(task: Value) : RemoteIngestTask = {
    val id = task.get("id").asString()
    val status = RemoteIngestStatus.withName(task.get("status").asString())
    val blobUris = task.get("blobUris").asList().asScala.toList.map(_.asInstanceOf[String])
    RemoteIngestTask(id, status, blobUris)
  }


  // See WebpageSnapshot type in transcription-service - this type needs to be kept in sync with that type
  case class WebpageSnapshotFiles(screenshot: Path, screenshotFingerprint: String, html: Path, htmlFingerprint: String, baseFilename: String)

  case class WebpageSnapshot(html: String, screenshotBase64: String, title: String)
  object WebpageSnapshot {
    implicit val webpageSnapshotFormat: OFormat[WebpageSnapshot] = Json.format[WebpageSnapshot]
  }
}

case class RemoteIngest(
  id: String,
  title: String,
  workspaceId: String,
  parentFolderId: String,
  collection: String,
  ingestion: String,
  createdAt: DateTime,
  url: String,
  addedBy: PartialUser,
  tasks: Map[String, RemoteIngestTask]
) {

  def taskKey(taskId: String): (Long, UUID) = RemoteIngest.ingestionKey(createdAt, taskId)

  private val finishedStatuses = Set(RemoteIngestStatus.Completed, RemoteIngestStatus.Failed, RemoteIngestStatus.TimedOut)

  def timedOut: Boolean = new DateTime().minusHours(2).isAfter(createdAt)

  def combinedStatus: RemoteIngestStatus.RemoteIngestStatus = {
    // if all tasks are complete
    if (tasks.values.forall(t => finishedStatuses.contains(t.status))) {
      // if at least one task has completed successfully, assume that other tasks that failed aren't of interest
      // (e.g. media download task for a page without a video)
      if (tasks.values.exists(_.status == RemoteIngestStatus.Completed)) {
        RemoteIngestStatus.Completed
      } else {
        RemoteIngestStatus.Failed
      }
    } else if (timedOut) {
      RemoteIngestStatus.TimedOut
    } else if (tasks.values.exists(_.status == RemoteIngestStatus.Ingesting)) {
      RemoteIngestStatus.Ingesting
    } else {
      RemoteIngestStatus.Queued
    }
  }

  def tasksRemaining: Int = {
    tasks.values.count(t => !finishedStatuses.contains(t.status) )
  }
  
}

object RemoteIngest extends Logging {
  implicit val dateWrites: Writes[DateTime] = JodaReadWrites.dateWrites
  implicit val dateReads: Reads[DateTime] = JodaReadWrites.dateReads
  implicit val remoteIngestWrites: Writes[RemoteIngest] = Json.writes[RemoteIngest]

  def ingestionKey(createdAt: DateTime, id: String) = (createdAt.getMillis, java.util.UUID.fromString(id))

  def sendRemoteIngestJob(id: String, url: String, createdAt: DateTime, mediaDownloadId: String, webpageSnapshotId: String, config: RemoteIngestConfig, snsClient: SnsClient, ingestStorage: IngestStorage): Either[String, String] = {
    logger.info(s"Sending job with id ${id}, topic: ${config.taskTopicArn}")
    val webpageSnapshotUrl = ingestStorage.getUploadSignedUrl(ingestionKey(createdAt, webpageSnapshotId)).getOrElse(throw new Exception(s"Failed to get webpage snapshot signed upload URL for job ${id}"))
    val mediaDownloadUrl = ingestStorage.getUploadSignedUrl(ingestionKey(createdAt, mediaDownloadId)).getOrElse(throw new Exception(s"Failed to get media download signed upload URL for job ${id}"))
    val remoteIngestJob = RemoteIngestJob(id, url, RemoteIngestJob.CLIENT_IDENTIFIER, config.outputQueueUrl, mediaDownloadId, webpageSnapshotId, webpageSnapshotUrl, mediaDownloadUrl)
    val jobJson = Json.stringify(Json.toJson(remoteIngestJob))
    val publishRequest = PublishRequest.builder()
      .topicArn(config.taskTopicArn)
      .message(jobJson)
      .build()
    try {
      snsClient.publish(publishRequest)
      Right(id)
    } catch {
      case e: Exception =>
        val msg = s"Failed to send job with id $id to SQS"
        logger.error(s"$msg: ${e.getMessage}", e)
        Left(msg)
    }
  }
}
