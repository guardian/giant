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

  def run(): Attempt[Unit] = Attempt.catchNonFatalBlasé {
    ingestions.foreach { case (collection, ingestion) =>
      deleteBlobsInBatches(collection, ingestion).await()
      ingestionService.deleteIngestion(collection, ingestion).await()
    }
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
    val conflictingIngestions = b.ingestion.filterNot(ingestionUris.contains)

    if(conflictingIngestions.nonEmpty) {
      conflictBehaviour.getOrElse(Stop) match {
        case Stop =>
          Attempt.Left(IllegalStateFailure(
            s"""${b.uri} cannot be deleted as it is also present in [${conflictingIngestions.mkString(" ")}].
        To delete it (and any other conflicting files) re-run the command passing in additional ingestions""")
          )
        case Skip =>
          logger.warn(
            s"""${b.uri} in [${b.ingestion.mkString(", ")}] is also present in [${conflictingIngestions.mkString(" ")}].
           Skipping for now.""".stripMargin)
          Attempt.Right(Unit)
        case Delete =>
              logger.warn(
                s"""${b.uri} in [${b.ingestion.mkString(", ")}] is also present in [${conflictingIngestions.mkString(" ")}].
                   Deleting it from all locations.""".stripMargin)
              ingestionService.deleteBlob(b.uri)
      }
    } else {
      logger.info(s"Deleting ${b.uri} from [${b.ingestion.mkString(", ")}]")
      ingestionService.deleteBlob(b.uri)
    }
  }
}
