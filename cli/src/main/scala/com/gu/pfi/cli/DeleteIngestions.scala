package com.gu.pfi.cli

import com.gu.pfi.cli.service.CliIngestionService
import utils.Logging
import utils.attempt.{Attempt, IllegalStateFailure}
import _root_.model.index.IndexedBlob
import com.gu.pfi.cli.model.{ConflictBehaviour, Delete, Skip, Stop}

import scala.concurrent.ExecutionContext
import utils.attempt.AttemptAwait._

class DeleteIngestions(ingestions: List[(String, String)], ingestionService: CliIngestionService, conflictBehaviour: Option[ConflictBehaviour])(implicit ec: ExecutionContext) extends Logging {
  private val ingestionUris = ingestions.map { case (c, i) => c + '/' + i }
  private var deletedCount = 0
  private var skippedCount = 0

  def run(): Attempt[Unit] = Attempt.catchNonFatalBlasé {
    logger.info(ConsoleColors.info(s"Starting deletion of ${ingestions.size} ingestion(s)..."))
    
    ingestions.foreach { case (collection, ingestion) =>
      logger.info(ConsoleColors.dim(s"Processing $collection/$ingestion..."))
      deleteBlobsInBatches(collection, ingestion).await()
      ingestionService.deleteIngestion(collection, ingestion).await()
    }
    
    logger.info(ConsoleColors.success(s"✓ Deletion complete: $deletedCount blobs deleted, $skippedCount skipped"))
  }

  private def deleteBlobsInBatches(collection: String, ingestion: String): Attempt[Unit] = {
    ingestionService.getBlobs(collection, ingestion, size = 200).flatMap {
      case Nil =>
        Attempt.Right(())

      case blobs =>
        deleteBatchOfBlobs(blobs).flatMap(_ => deleteBlobsInBatches(collection, ingestion))
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
          skippedCount += 1
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
