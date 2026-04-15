package com.gu.pfi.cli

import com.gu.pfi.cli.service.CliIngestionService
import utils.Logging
import utils.attempt.{Attempt, IllegalStateFailure}
import _root_.model.index.IndexedBlob
import com.gu.pfi.cli.model.{ConflictBehaviour, Delete, Skip, Stop}

import scala.concurrent.ExecutionContext
import utils.attempt.AttemptAwait._

class DeleteBlobs(
  collection: String,
  ingestion: String,
  pathPrefix: String,
  ingestionService: CliIngestionService,
  conflictBehaviour: Option[ConflictBehaviour]
)(implicit ec: ExecutionContext) extends Logging {

  private val ingestionUri = s"$collection/$ingestion"
  private var deletedCount = 0
  private var skippedCount = 0

  def run(): Attempt[Unit] = Attempt.catchNonFatalBlasé {
    logger.info(ConsoleColors.info(s"Deleting blobs matching prefix '$pathPrefix' in $ingestionUri..."))

    deleteBlobsInBatches()

    if (skippedCount > 0) {
      logger.warn(ConsoleColors.warning(
        s"⚠ $skippedCount blob(s) were skipped due to conflicts"
      ))
      logger.warn(ConsoleColors.warning(
        "  Consider re-running with --conflictBehaviour delete, or cleaning up conflicting ingestions first"
      ))
    }

    logger.info(ConsoleColors.success(s"✓ Deletion complete: $deletedCount blobs deleted, $skippedCount skipped"))
  }

  private def deleteBlobsInBatches(): Unit = {
    val result = ingestionService.getBlobsByPrefix(collection, ingestion, pathPrefix, size = 200).await()

    if (result.blobs.nonEmpty) {
      result.blobs.foreach { blob =>
        deleteBlob(blob, hasPathConflict = result.pathConflicts.contains(blob.uri)).await()
      }

      if (deletedCount % 1000 < 200) {
        logger.info(ConsoleColors.dim(s"  $deletedCount deleted, $skippedCount skipped so far..."))
      }

      deleteBlobsInBatches()
    }
  }

  private def deleteBlob(b: IndexedBlob, hasPathConflict: Boolean): Attempt[Unit] = {
    val conflictingIngestions = b.ingestions.filterNot(_ == ingestionUri)

    val conflictReason: Option[String] =
      if (conflictingIngestions.nonEmpty)
        Some(s"also present in ingestion(s) [${conflictingIngestions.mkString(", ")}]")
      else if (hasPathConflict)
        Some("also exists at other paths within this ingestion outside the target prefix")
      else
        None

    conflictReason match {
      case Some(reason) =>
        conflictBehaviour.getOrElse(Stop) match {
          case Stop =>
            Attempt.Left(IllegalStateFailure(
              s"${b.uri} cannot be deleted: $reason. " +
                "Re-run with --conflictBehaviour skip to leave conflicting files, or --conflictBehaviour delete to force deletion"
            ))
          case Skip =>
            skippedCount += 1
            if (logger.isDebugEnabled) {
              logger.warn(s"${b.uri}: $reason. Skipping.")
            }
            Attempt.Right(())
          case Delete =>
            deletedCount += 1
            if (logger.isDebugEnabled) {
              logger.warn(s"${b.uri}: $reason. Deleting anyway.")
            }
            ingestionService.deleteBlob(b.uri)
        }
      case None =>
        deletedCount += 1
        if (logger.isDebugEnabled) {
          logger.info(s"Deleting ${b.uri}")
        }
        ingestionService.deleteBlob(b.uri)
    }
  }
}
