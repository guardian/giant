package model.ingestion

import model.frontend.user.PartialUser
import com.amazonaws.services.sns.AmazonSNS
import com.amazonaws.services.sns.model.PublishRequest
import model.annotations.{ProcessingStage, WorkspaceEntry, WorkspaceLeaf, WorkspaceNode}
import model.frontend.{TreeEntry, TreeLeaf, TreeNode}
import org.joda.time.DateTime
import play.api.libs.json.{Format, JsError, JsResult, JsString, JsSuccess, JsValue, Json, OFormat, Reads, Writes}
import services.observability.JodaReadWrites
import services.{IngestStorage, RemoteIngestConfig}
import utils.Logging

import java.nio.file.Path
import java.util.{UUID, Map => JavaMap}
import scala.jdk.CollectionConverters.{CollectionHasAsScala, MapHasAsScala}

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

case class RemoteIngestTask(id: String, status: RemoteIngestStatus.RemoteIngestStatus, blobUris: List[String], title: String){}
object RemoteIngestTask {
  implicit val remoteIngestTaskFormat: OFormat[RemoteIngestTask] = Json.format[RemoteIngestTask]

  // See WebpageSnapshot type in transcription-service - this type needs to be kept in sync with that type
  case class WebpageSnapshotFiles(screenshot: Path, screenshotFingerprint: String, html: Path, htmlFingerprint: String, baseFilename: String)

  case class WebpageSnapshot(html: String, screenshotBase64: String, title: String)
  object WebpageSnapshot {
    implicit val webpageSnapshotFormat: OFormat[WebpageSnapshot] = Json.format[WebpageSnapshot]
  }

  def apply(isTimedOut: Boolean)(neo4jValue: AnyRef): (String, RemoteIngestTask) = {
    val taskMap = neo4jValue.asInstanceOf[JavaMap[String, Object]].asScala.toMap
    val taskId = taskMap("id").asInstanceOf[String]
    taskId -> RemoteIngestTask(
      id = taskId,
      status = if (isTimedOut) RemoteIngestStatus.TimedOut else RemoteIngestStatus withName taskMap("status").asInstanceOf[String],
      blobUris = taskMap("blobUris").asInstanceOf[java.util.List[String]].asScala.toList,
      title = taskMap.get("type").filter(_ != null).map(_.asInstanceOf[String]).getOrElse(taskId) match {
        case "WebpageSnapshot" => "Snapshotting the webpage..."
        case "MediaDownload" => "Downloading video (if any)..."
        case other => other
      }
    )
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

  def tasksRemaining: Int = {
    tasks.values.count(t => !finishedStatuses.contains(t.status) )
  }

  def asSyntheticEntries(findExistingFolderId: (String, String) => Option[String]): List[TreeEntry[WorkspaceEntry]] = {

    val addedOn = Some(createdAt.getMillis)

    val maybeExistingFolderId = findExistingFolderId(parentFolderId, title)

    val jobId = s"RemoteIngest/$id"

    val taskLeaves = tasks.values.map{task =>
      val taskId = s"RemoteIngestTask/${task.id}"
      TreeLeaf[WorkspaceLeaf](
      id = taskId,
      name = task.title,
      data = WorkspaceLeaf(
        uri = taskId,
        mimeType = "Capture from URL",
        maybeParentId = maybeExistingFolderId.orElse(Some(jobId)),
        addedOn = addedOn,
        addedBy = addedBy,
        processingStage = task.status match {
          case RemoteIngestStatus.Failed | RemoteIngestStatus.TimedOut => ProcessingStage.Failed
          case RemoteIngestStatus.Queued | RemoteIngestStatus.Ingesting => ProcessingStage.Processing(
            tasksRemaining = 1,
            note = Some(task.status.toString)
          )
          // completed tasks are filtered out in the getRelevantRemoteIngestJobs query, so the following shouldn't happen
          case RemoteIngestStatus.Completed => ProcessingStage.Processed
        },
        size = None
      ),
      isExpandable = false
    )}.toList

    taskLeaves ++ (maybeExistingFolderId match {
      case None if taskLeaves.nonEmpty => List(TreeNode( // synthesise a folder
        id = jobId,
        name = s"$title (Capturing: $url)",
        data = WorkspaceNode(
          addedBy,
          addedOn,
          maybeParentId = Some(parentFolderId),
          // these counts should get corrected in `getWorkspaceContents`
          descendantsLeafCount = 0,
          descendantsNodeCount = 0,
          descendantsProcessingTaskCount = 0,
          descendantsFailedCount = 0
        ),
        // confusingly we return an empty list here - the folder structure is built later
        // (note that the leaves reference this node in their maybeParentId)
        children = List()
      ))
      case _ => List()
    })
  }
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
