package model.ingestion

import model.frontend.user.PartialUser
import com.amazonaws.services.sns.AmazonSNS
import com.amazonaws.services.sns.model.PublishRequest
import org.joda.time.DateTime
import play.api.libs.json.{Json, Reads, Writes}
import services.observability.JodaReadWrites
import services.{IngestStorage, RemoteIngestConfig}
import utils.Logging

object RemoteIngestStatus extends Enumeration {
  type RemoteIngestStatus = Value
  val Queued, Ingesting, Completed, Failed  = Value
}

case class RemoteIngestTask(id: String, blobUris: List[String])
object RemoteIngestTask {
  implicit val remoteIngestTaskFormat = Json.format[RemoteIngestTask]
}

case class RemoteIngest(
  id: String,
  title: String,
  status: RemoteIngestStatus.RemoteIngestStatus,
  workspaceId: String,
  parentFolderId: String,
  collection: String,
  ingestion: String,
  createdAt: DateTime,
  url: String,
  addedBy: PartialUser,
  mediaDownload: RemoteIngestTask,
  webpageSnapshot: RemoteIngestTask
) {

  val mediaDownloadIngestionKey: Key = RemoteIngest.ingestionKey(createdAt, mediaDownload.id)
  val webpageSnapshotIngestionKey: Key = RemoteIngest.ingestionKey(createdAt, webpageSnapshot.id)
  // val timeoutAt = createdAt.plus(Duration.standardHours(4)) TODO implement timeouts
}

object RemoteIngest extends Logging {
  implicit val dateWrites: Writes[DateTime] = JodaReadWrites.dateWrites
  implicit val dateReads: Reads[DateTime] = JodaReadWrites.dateReads
  implicit val remoteIngestWrites: Writes[RemoteIngest] = Json.writes[RemoteIngest]

  def ingestionKey(createdAt: DateTime, id: String) = (createdAt.getMillis, java.util.UUID.fromString(id))

  def sendRemoteIngestJob(id: String, url: String, createdAt: DateTime, mediaDownloadId: String, webpageSnapshotId: String, config: RemoteIngestConfig, amazonSNSClient: AmazonSNS, ingestStorage: IngestStorage): Either[String, String] = {
    logger.info(s"Sending job with id ${id}, queue: ${config.taskTopicArn}")
    val webpageSnapshotUrl = ingestStorage.getUploadSignedUrl(ingestionKey(createdAt, webpageSnapshotId)).getOrElse(throw new Exception(s"Failed to get webpage snapshot signed upload URL for job ${id}"))
    val mediaDownloadUrl = ingestStorage.getUploadSignedUrl(ingestionKey(createdAt, mediaDownloadId)).getOrElse(throw new Exception(s"Failed to get media download signed upload URL for job ${id}"))
    val remoteIngestJob = RemoteIngestJob(id, url, RemoteIngestJob.CLIENT_IDENTIFIER, config.outputQueueUrl, webpageSnapshotUrl, mediaDownloadUrl)
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
