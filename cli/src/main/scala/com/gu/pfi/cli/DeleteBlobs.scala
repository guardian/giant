package com.gu.pfi.cli

import com.gu.pfi.cli.service.CliIngestionService
import utils.Logging
import utils.attempt.{Attempt, IllegalStateFailure}
import _root_.model.index.IndexedBlob
import com.gu.pfi.cli.model.{ConflictBehaviour, Delete, Skip, Stop}

import scala.collection.mutable
import scala.concurrent.ExecutionContext

class DeleteBlobs(
  collection: String,
  ingestion: String,
  pathPrefix: String,
  ingestionService: CliIngestionService,
  conflictBehaviour: Option[ConflictBehaviour]
)(implicit ec: ExecutionContext) extends Logging {

  private val ingestionUri = s"$collection/$ingestion"
  private var deletedCount = 0
  // Blobs we have decided not to delete (conflictBehaviour=skip). The index still returns
  // them on every page, so we must remember them both to fetch past them and to avoid
  // re-processing them forever.
  private val skippedBlobUris = mutable.Set.empty[String]

  private val batchSize = 200
  private val maxFetchSize = 10000

  def run(): Attempt[Unit] = {
    logger.info(ConsoleColors.info(s"Deleting blobs matching prefix '$pathPrefix' in $ingestionUri..."))

    deleteBlobsInBatches().map { _ =>
      if (skippedBlobUris.nonEmpty) {
        logger.warn(ConsoleColors.warning(
          s"⚠ ${skippedBlobUris.size} blob(s) were skipped due to conflicts"
        ))
        logger.warn(ConsoleColors.warning(
          "  Consider re-running with --conflictBehaviour delete, or cleaning up conflicting ingestions first"
        ))
      }

      logger.info(ConsoleColors.success(s"✓ Deletion complete: $deletedCount blobs deleted, ${skippedBlobUris.size} skipped"))
    }
  }

  private def deleteBlobsInBatches(): Attempt[Unit] = {
    // Fetch enough to see past the blobs we have already skipped: a fixed page size
    // would refetch the same skipped blobs forever once only those remain.
    val fetchSize = math.min(batchSize + skippedBlobUris.size, maxFetchSize)

    ingestionService.getBlobsByPrefix(collection, ingestion, pathPrefix, size = fetchSize).flatMap { result =>
      result.blobs.filterNot(blob => skippedBlobUris.contains(blob.uri)) match {
        case Nil if result.blobs.size >= maxFetchSize =>
          Attempt.Left(IllegalStateFailure(
            s"${skippedBlobUris.size} skipped blob(s) is too many to page past. " +
              "Re-run with --conflictBehaviour delete, or clean up the conflicting ingestions first"
          ))

        case Nil =>
          Attempt.Right(())

        case blobs =>
          deleteBatchOfBlobs(blobs.take(batchSize), result.pathConflicts).flatMap { _ =>
            logger.info(ConsoleColors.dim(s"  $deletedCount deleted, ${skippedBlobUris.size} skipped so far..."))
            deleteBlobsInBatches()
          }
      }
    }
  }

  private def deleteBatchOfBlobs(blobs: List[IndexedBlob], pathConflicts: Set[String]): Attempt[Unit] = blobs match {
    case Nil =>
      Attempt.Right(())

    case blob :: rest =>
      deleteBlob(blob, hasPathConflict = pathConflicts.contains(blob.uri)).flatMap(_ => deleteBatchOfBlobs(rest, pathConflicts))
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
            skippedBlobUris += b.uri
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
