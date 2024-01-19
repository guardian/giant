package commands

import java.nio.file.Path
import java.nio.file.attribute.FileTime
import ingestion.IngestionContextBuilder
import model.Uri
import model.ingestion.{FileContext, WorkspaceItemContext, WorkspaceItemUploadContext}
import model.manifest.{Blob, Ingestion}
import play.api.libs.json.{Format, Json}
import services.FingerprintServices
import services.annotations.Annotations
import services.events.{ActionComplete, Events}
import services.ingestion.IngestionServices
import services.manifest.Manifest
import services.observability.{IngestionEvent, EventStatus}
import utils.attempt.{Attempt, MissingPermissionFailure}

import scala.concurrent.ExecutionContext

case class IngestFileResult(blob: Blob, workspaceNodeId: Option[String])
object IngestFileResult {
  implicit val format: Format[IngestFileResult] = Json.format[IngestFileResult]
}

class IngestFile(collectionUri: Uri, ingestionUri: Uri, uploadId: String, workspace: Option[WorkspaceItemUploadContext],
                 username: String, temporaryFilePath: Path, originalPath: Path, lastModifiedTime: Option[String],
                 manifest: Manifest, esEvents: Events, ingestionServices: IngestionServices, annotations: Annotations, fingerPrint: Option[String] = None)(implicit ec: ExecutionContext) extends AttemptCommand[IngestFileResult] {

  override def process(): Attempt[IngestFileResult] = {
    for {
      ingestion <- getIngestion()

      fileUri = fingerPrint.getOrElse(FingerprintServices.createFingerprintFromFile(temporaryFilePath.toFile))
      // workspace will only be defined for user uploads. If it is defined we want to add a WorkspaceUpload ingestion event
      workspaceEvent = workspace.map(w =>
        IngestionEvent.workspaceUploadEvent(fileUri, ingestionUri.value, w.workspaceName, EventStatus.Started)
      )
      _ = workspaceEvent.foreach(ingestionServices.recordIngestionEvent)
      metadata = buildMetadata(ingestion, lastModifiedTime, workspace.map(WorkspaceItemContext.fromUpload(fileUri, _)))
      blob <- Attempt.fromEither(ingestionServices.ingestFile(metadata, Uri(fileUri), temporaryFilePath))
      workspaceNodeId <- addToWorkspaceIfRequired(blob)
    } yield {
      workspaceEvent.foreach(e => ingestionServices.recordIngestionEvent(e.copy(status = EventStatus.Success)))
      esEvents.record(
        ActionComplete,
        s"User $username Uploaded '$originalPath' to ingestion '${ingestionUri.value}'",
        Map(
          "type" -> "upload",
          "collection" -> collectionUri.value,
          "username" -> username,
          "originalPath" -> originalPath.toString,
          "uploadId" -> uploadId
        ) ++ workspace.map { w => "workspace" -> w.workspaceName }
      )

      IngestFileResult(blob, workspaceNodeId)
    }
  }

  private def addToWorkspaceIfRequired(blob: Blob): Attempt[Option[String]] = workspace match {
    case Some(WorkspaceItemUploadContext(workspaceId, workspaceNodeId, workspaceParentNodeId, _)) =>
      annotations.addResourceToWorkspaceFolder(
        username,
        // TODO MRB: create intermediate folders on the server?
        originalPath.getFileName.toString,
        blob.uri,
        Some(blob.size),
        blob.mimeType.headOption.map(_.mimeType),
        icon = "document",
        workspaceId,
        workspaceParentNodeId,
        workspaceNodeId
      ).map(Some(_))

    case _ =>
      Attempt.Right(None)
  }

  private def getIngestion(): Attempt[Ingestion] = {
    manifest.getIngestion(ingestionUri).flatMap { ingestion =>
      if (ingestion.fixed) {
        Attempt.Left(MissingPermissionFailure(s"Cannot upload to $ingestionUri: fixed=true"))
      } else {
        Attempt.Right(ingestion)
      }
    }
  }

  private def buildMetadata(ingestion: Ingestion, lastModified: Option[String], workspace: Option[WorkspaceItemContext]): FileContext = {
    val lastModifiedTime = lastModified.map(lastModified => FileTime.fromMillis(lastModified.toLong))

    // No parent blobs, this is a file where the URI leads directly back up to the ingestion
    IngestionContextBuilder.fromIngestion(ingestion.uri, ingestion.languages, workspace)
      .pushParentDirectories(originalPath)
      .finish(originalPath.getFileName.toString, temporaryFilePath, None, None, lastModifiedTime)
  }
}
