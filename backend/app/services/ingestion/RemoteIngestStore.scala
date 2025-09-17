package services.ingestion

import model.ingestion.RemoteIngest
import model.ingestion.RemoteIngestStatus.RemoteIngestStatus
import utils.attempt.{Attempt, Failure}

trait RemoteIngestStore {
  def setup(): Either[Failure, Unit]

  def insertRemoteIngest(ingest: RemoteIngest): Attempt[String]
  def getRemoteIngestJob(id: String): Attempt[RemoteIngest]
  def getRemoteIngestJobs(maybeWorkspaceId: Option[String], maybeOnlyStatuses: List[RemoteIngestStatus], maybeSinceUTCEpoch: Option[Long]): Attempt[List[RemoteIngest]]
  def updateRemoteIngestJobStatus(id: String, status: RemoteIngestStatus): Attempt[Unit]
  def updateRemoteIngestJobBlobUri(id: String, blobUri: String): Attempt[Unit]

}
