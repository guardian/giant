package model.ingestion

import model.frontend.user.PartialUser
import com.amazonaws.services.sns.AmazonSNS
import com.amazonaws.services.sns.model.PublishRequest
import org.joda.time.DateTime
import play.api.libs.json.{Format, JsError, JsResult, JsString, JsSuccess, JsValue, Json, Reads, Writes}
import services.observability.JodaReadWrites
import services.{IngestStorage, RemoteIngestConfig}
import utils.Logging
import org.neo4j.driver.v1.Value

import scala.jdk.CollectionConverters.CollectionHasAsScala

object RemoteIngestStatus extends Enumeration {
  type RemoteIngestStatus = Value
  val Queued, Ingesting, Completed, Failed  = Value

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
  implicit val remoteIngestTaskFormat = Json.format[RemoteIngestTask]

  def fromNeo4jValue(task: Value) : RemoteIngestTask = {
    val id = task.get("id").asString()
    val status = RemoteIngestStatus.withName(task.get("status").asString())
    val blobUris = task.get("blobUris").asList().asScala.toList.map(_.asInstanceOf[String])
    RemoteIngestTask(id, status, blobUris)
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

  def taskKey(taskId: String) = RemoteIngest.ingestionKey(createdAt, taskId)
  
}

object RemoteIngest extends Logging {
  implicit val dateWrites: Writes[DateTime] = JodaReadWrites.dateWrites
  implicit val dateReads: Reads[DateTime] = JodaReadWrites.dateReads
  implicit val remoteIngestWrites: Writes[RemoteIngest] = Json.writes[RemoteIngest]

  def ingestionKey(createdAt: DateTime, id: String) = (createdAt.getMillis, java.util.UUID.fromString(id))

  def sendRemoteIngestJob(id: String, url: String, createdAt: DateTime, mediaDownloadId: String, webpageSnapshotId: String, config: RemoteIngestConfig, amazonSNSClient: AmazonSNS, ingestStorage: IngestStorage): Either[String, String] = {
    logger.info(s"Sending job with id ${id}, topic: ${config.taskTopicArn}")
    val webpageSnapshotUrl = ingestStorage.getUploadSignedUrl(ingestionKey(createdAt, webpageSnapshotId)).getOrElse(throw new Exception(s"Failed to get webpage snapshot signed upload URL for job ${id}"))
    val mediaDownloadUrl = ingestStorage.getUploadSignedUrl(ingestionKey(createdAt, mediaDownloadId)).getOrElse(throw new Exception(s"Failed to get media download signed upload URL for job ${id}"))
    val remoteIngestJob = RemoteIngestJob(id, url, RemoteIngestJob.CLIENT_IDENTIFIER, config.outputQueueUrl, mediaDownloadId, webpageSnapshotId, webpageSnapshotUrl, mediaDownloadUrl)
    val jobJson = Json.stringify(Json.toJson(remoteIngestJob))
    val publishRequest = new PublishRequest()
      .withTopicArn(config.taskTopicArn)
      .withMessage(jobJson)
    try {
      amazonSNSClient.publish(publishRequest)
      Right(id)
    } catch {
      case e: Exception =>
        val msg = s"Failed to send job with id $id to SQS"
        logger.error(s"$msg: ${e.getMessage}", e)
        Left(msg)
    }
  }
}
