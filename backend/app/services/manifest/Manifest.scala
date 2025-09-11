package services.manifest

import commands.IngestFileResult
import extraction.{ExtractionParams, Extractor}
import model._
import model.annotations.WorkspaceMetadata
import model.frontend.email.EmailNeighbours
import model.frontend.{BasicResource, ExtractionFailures, ResourcesForExtractionFailure}
import model.ingestion.{IngestionFile, RemoteIngest, WorkspaceItemContext, WorkspaceItemUploadContext}
import model.manifest._
import services.manifest.Manifest.WorkCounts
import utils.attempt.{Attempt, Failure}

import java.nio.file.Path

object Manifest {
  sealed trait Insertion
  case class InsertDirectory(parentUri: Uri, uri: Uri) extends Insertion
  case class InsertBlob(file: IngestionFile, blobUri: Uri, parentBlobs: List[Uri], mimeType: MimeType, ingestion: String,
                        languages: List[String], extractors: Iterable[Extractor], workspace: Option[WorkspaceItemContext]) extends Insertion
  case class InsertEmail(email: Email, parent: Uri) extends Insertion

  case class WorkCounts(inProgress: Int, outstanding: Int)
}

trait WorkerManifest {
  def fetchWork(workerName: String, maxBatchSize: Int, maxCost: Int): Either[Failure, List[WorkItem]]

  def releaseLocks(workerName: String): Either[Failure, Unit]

  def releaseLocksForTerminatedWorkers(currentWorkerNames: List[String]): Either[Failure, Unit]

  def markAsComplete(params: ExtractionParams, blob: Blob, extractor: Extractor): Either[Failure, Unit]
  def markExternalAsProcessing(params: ExtractionParams, blob: Blob, extractor: Extractor): Either[Failure, Unit]

  def markExternalAsComplete(uri: String, extractorName: String): Either[Failure, Unit]

  def logExtractionFailure(blobUri: Uri, extractorName: String, stackTrace: String): Either[Failure, Unit]

  def setProgressNote(blobUri: Uri, extractor: Extractor, note: String): Either[Failure, Unit]

  def getWorkCounts(): Either[Failure, WorkCounts]
}

trait Manifest extends WorkerManifest {
  def setup(): Either[Failure, Unit]

  def maxExtractionAttempts: Int = 1

  def insert(insertions: Seq[Manifest.Insertion], rootUri: Uri): Either[Failure, Unit]

  def insertCollection(uri: String, display: String, createdBy: String): Attempt[Collection]

  def getCollections: Attempt[List[Collection]]

  def getCollectionsForBlob(blobUri: String): Attempt[Map[Collection, Seq[String]]]

  def getWorkspacesForBlob(blobUri: String): Attempt[List[WorkspaceMetadata]]

  def getResource(resourceUri: Uri): Either[Failure, BasicResource]

  def getIngestions(collection: Uri): Attempt[Seq[Ingestion]]

  def getCollection(collection: Uri): Attempt[Collection]

  def getIngestionCount(collection: Uri): Attempt[Int]

  def getIngestion(uri: Uri): Attempt[Ingestion]

  def insertIngestion(collectionUri: Uri, ingestionUri: Uri, display: String, path: Option[Path], languages: List[Language], fixed: Boolean, default: Boolean): Attempt[Uri]

  def getFailedExtractions: Either[Failure, ExtractionFailures]

  def getResourcesForExtractionFailure(extractor: String, stackTrace: String, page: Long, skip: Long, pageSize: Long): Either[Failure, ResourcesForExtractionFailure]

  def getMimeTypesCoverage: Either[Failure, List[MimeTypeCoverage]]

  def getFilterableMimeTypes: Either[Failure, List[MimeType]]

  def getAllMimeTypes: Attempt[List[MimeType]]

  def rerunSuccessfulExtractorsForBlob(uri: Uri): Attempt[Unit]

  def rerunFailedExtractorsForBlob(uri: Uri): Attempt[Unit]

  def rerunFailedExternalExtractorsForBlob(uri: Uri): Attempt[Unit]

  def getBlob(uri: Uri): Either[Failure, Blob]

  def getBlobsForFiles(fileUris: List[String]): Either[Failure, Map[String, Blob]]

  def getEmailThread(uri: String): Attempt[List[EmailNeighbours]]

  def getLanguagesProcessedByOcrMyPdf(uri: Uri): Attempt[List[Language]]

  def deleteBlob(uri: Uri): Attempt[Unit]

  def deleteResourceAndDescendants(uri: Uri): Attempt[Unit]

  def getWorkspaceChildrenWithUri(workspaceNodeId: Option[WorkspaceItemUploadContext], childUri: String): Attempt[List[IngestFileResult]]
}
