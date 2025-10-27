package services.ingestion

import model.ingestion.RemoteIngest
import org.joda.time.DateTime
import model.ingestion.RemoteIngestStatus.RemoteIngestStatus
import utils.attempt.{Attempt, Failure}

trait RemoteIngestStore {
  def setup(): Either[Failure, Unit]

  def insertRemoteIngest(
    id: String,
    title: String,
    workspaceId: String,
    parentFolderId: String,
    collection: String,
    createdAt: DateTime,
    url: String,
    username:String,
    mediaDownloadId: String,
    webpageSnapshotId: String
  ): Attempt[String]
  def getRemoteIngestJob(id: String): Attempt[RemoteIngest]
  def getRemoteIngestJobs(maybeWorkspaceId: Option[String], maybeOnlyStatuses: List[RemoteIngestStatus], maybeSinceUTCEpoch: Option[Long]): Attempt[List[RemoteIngest]]
  def getRelevantRemoteIngestJobs(workspaceId: String): Attempt[List[RemoteIngest]]
  def updateRemoteIngestTaskStatus(taskId: String, status: RemoteIngestStatus): Attempt[Unit]
  def updateRemoteIngestTaskBlobUris(taskId: String, blobUris: List[String]): Attempt[Unit]

}
