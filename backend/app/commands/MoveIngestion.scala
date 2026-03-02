package commands

import model.Uri
import services.index.Index
import services.manifest.Manifest
import utils.Logging
import utils.attempt._

import scala.concurrent.ExecutionContext

case class MoveIngestion(
  ingestionUri: Uri,
  targetCollectionUri: Uri,
  manifest: Manifest,
  index: Index
)(implicit ec: ExecutionContext) extends AttemptCommand[Uri] with Logging {

  def process(): Attempt[Uri] = {
    logger.info(s"Moving ingestion ${ingestionUri.value} to collection ${targetCollectionUri.value}")

    for {
      // Validate that target collection exists
      _ <- manifest.getCollection(targetCollectionUri)

      // Extract the ingestion name and build the new URI
      ingestionName = ingestionUri.value.split("/").last
      newIngestionUri = targetCollectionUri.chain(ingestionName)

      // Determine if Neo4j needs updating or was already moved (e.g. retrying after an ES failure)
      alreadyMoved <- manifest.getIngestion(newIngestionUri).transform(
        _ => Attempt.Right(true),   // new URI exists — Neo4j was already updated
        _ => Attempt.Right(false)   // new URI doesn't exist — need to move
      )

      _ <- if (alreadyMoved) {
        logger.info(s"Ingestion already exists at ${newIngestionUri.value}, skipping Neo4j update (likely a retry)")
        Attempt.Right(())
      } else {
        for {
          // Validate that source ingestion exists
          _ <- manifest.getIngestion(ingestionUri)
          // Move in Neo4j
          _ <- manifest.moveIngestionToCollection(ingestionUri, targetCollectionUri, newIngestionUri)
          _ = logger.info(s"Updated Neo4j relationships and properties")
        } yield ()
      }

      // Update Elasticsearch (idempotent — no-op if documents already have the new path)
      _ <- index.updateIngestionPath(ingestionUri.value, newIngestionUri.value).recoverWith {
        case failure =>
          logger.error(s"MANUAL FIX REQUIRED: Neo4j updated but Elasticsearch failed. " +
            s"Old ingestion path: ${ingestionUri.value}, new ingestion path: ${newIngestionUri.value}. " +
            s"Re-run this command to retry the ES update. Error: ${failure.msg}")
          Attempt.Left(failure)
      }

      _ = logger.info(s"Successfully moved ingestion from ${ingestionUri.value} to ${newIngestionUri.value}")
    } yield newIngestionUri
  }
}
