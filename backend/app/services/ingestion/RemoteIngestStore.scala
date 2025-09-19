package services.ingestion

import model.ingestion.RemoteIngest
import utils.attempt.{Attempt, Failure}

trait RemoteIngestStore {
  def setup(): Either[Failure, Unit]

  def insertRemoteIngest(ingest: RemoteIngest): Attempt[String]
  def getRemoteIngestJob(id: String): Attempt[RemoteIngest]
  def getRemoteIngestJobs(status: Option[String]): Attempt[List[RemoteIngest]]
  def updateRemoteIngestJobStatus(id: String, status: String): Attempt[Unit]
  def updateRemoteIngestJobBlobUri(id: String, blobUri: String): Attempt[Unit]

}
