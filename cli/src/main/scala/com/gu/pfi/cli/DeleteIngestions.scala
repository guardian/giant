package com.gu.pfi.cli

import com.gu.pfi.cli.service.CliIngestionService
import utils.Logging
import utils.attempt.{Attempt, IllegalStateFailure}
import _root_.model.index.IndexedBlob
import com.gu.pfi.cli.model.{ConflictBehaviour, Delete, Skip, Stop}

import scala.collection.mutable
import scala.concurrent.ExecutionContext
import utils.attempt.AttemptAwait._

class DeleteIngestions(ingestions: List[(String, String)], ingestionService: CliIngestionService, conflictBehaviour: Option[ConflictBehaviour])(implicit ec: ExecutionContext) extends Logging {
  private val ingestionUris = ingestions.map { case (c, i) => c + '/' + i }
  private var deletedCount = 0
  // Blobs we have decided not to delete (conflictBehaviour=skip). The index returns them on
  // every page, so we must remember them both to fetch past them and to avoid re-processing.
  private val skippedBlobUris = mutable.Set.empty[String]

  private val batchSize = 200
  private val maxFetchSize = 10000

  def run(): Attempt[Unit] = Attempt.catchNonFatalBlasé {
    logger.info(ConsoleColors.info(s"Starting deletion of ${ingestions.size} ingestion(s)..."))

    ingestions.foreach { case (collection, ingestion) =>
      logger.info(ConsoleColors.dim(s"Processing $collection/$ingestion..."))
      deleteBlobsInBatches(collection, ingestion).await()
      ingestionService.deleteIngestion(collection, ingestion).await()
      logger.info(ConsoleColors.dim(s"  Deleted ingestion $collection/$ingestion"))
    }

    if (skippedBlobUris.nonEmpty) {
      logger.warn(ConsoleColors.warning(
        s"⚠ ${skippedBlobUris.size} blob(s) were skipped because they also belong to other ingestions — they remain available there"
      ))
      logger.warn(ConsoleColors.warning(
        "  To remove them from Giant entirely, re-run with --conflictBehaviour delete, or pass all the ingestions that share them"
      ))
    }

    logger.info(ConsoleColors.success(s"✓ Deletion complete: $deletedCount blobs deleted, ${skippedBlobUris.size} skipped"))
  }

  private def deleteBlobsInBatches(collection: String, ingestion: String): Attempt[Unit] = {
    // Fetch enough to see past the blobs we have already skipped: the index still returns
    // them on every page, so a fixed page size would refetch the same skipped blobs forever
    // once only those remain.
    val fetchSize = math.min(batchSize + skippedBlobUris.size, maxFetchSize)

    ingestionService.getBlobs(collection, ingestion, size = fetchSize).flatMap { fetched =>
      fetched.filterNot(blob => skippedBlobUris.contains(blob.uri)) match {
        case Nil if fetched.size >= maxFetchSize =>
          Attempt.Left(IllegalStateFailure(
            s"${skippedBlobUris.size} skipped blob(s) is too many to page past. " +
              "Re-run with --conflictBehaviour delete, or delete the conflicting ingestions first"
          ))

        case Nil =>
          Attempt.Right(())

        case blobs =>
          deleteBatchOfBlobs(blobs.take(batchSize)).flatMap { _ =>
            logger.info(ConsoleColors.dim(s"  $deletedCount deleted, ${skippedBlobUris.size} skipped so far..."))
            deleteBlobsInBatches(collection, ingestion)
          }
      }
    }
  }

  private def deleteBatchOfBlobs(blobs: List[IndexedBlob]): Attempt[Unit] = blobs match {
    case Nil =>
      Attempt.Right(())

    case blob :: rest =>
      deleteBlob(blob).flatMap(_ => deleteBatchOfBlobs(rest))
  }

  private def deleteBlob(b: IndexedBlob): Attempt[Unit] = {
    val conflictingIngestions = b.ingestions.filterNot(ingestionUris.contains)

    if(conflictingIngestions.nonEmpty) {
      conflictBehaviour.getOrElse(Stop) match {
        case Stop =>
          Attempt.Left(IllegalStateFailure(
            s"""${b.uri} cannot be deleted as it is also present in [${conflictingIngestions.mkString(" ")}].
        To delete it (and any other conflicting files) re-run the command passing in additional ingestions""")
          )
        case Skip =>
          skippedBlobUris += b.uri
          if (logger.isDebugEnabled) {
            logger.warn(
              s"""${b.uri} in [${b.ingestions.mkString(", ")}] is also present in [${conflictingIngestions.mkString(" ")}].
             Skipping for now.""".stripMargin)
          }
          Attempt.Right(())
        case Delete =>
          deletedCount += 1
          if (logger.isDebugEnabled) {
            logger.warn(
              s"""${b.uri} in [${b.ingestions.mkString(", ")}] is also present in [${conflictingIngestions.mkString(" ")}].
                 Deleting it from all locations.""".stripMargin)
          }
          ingestionService.deleteBlob(b.uri)
      }
    } else {
      deletedCount += 1
      if (logger.isDebugEnabled) {
        logger.info(s"Deleting ${b.uri} from [${b.ingestions.mkString(", ")}]")
      }
      ingestionService.deleteBlob(b.uri)
    }
  }
}
