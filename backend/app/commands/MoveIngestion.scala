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
      // Validate that source ingestion exists
      ingestion <- manifest.getIngestion(ingestionUri)
      _ = logger.info(s"Found ingestion: ${ingestion.display}")

      // Validate that target collection exists
      targetCollection <- manifest.getCollection(targetCollectionUri)
      _ = logger.info(s"Found target collection: ${targetCollection.display}")

      // Extract the ingestion name from the URI (e.g., "old-collection/my-ingestion" -> "my-ingestion")
      ingestionName = ingestionUri.value.split("/").last
      
      // Build the new ingestion URI
      newIngestionUri = targetCollectionUri.chain(ingestionName)
      _ = logger.info(s"New ingestion URI will be: ${newIngestionUri.value}")

      // Check if an ingestion with the new URI already exists
      existingCheck <- manifest.getIngestion(newIngestionUri).transform(
        existing => Attempt.Left[Unit](IllegalStateFailure(s"An ingestion named '$ingestionName' already exists in collection '${targetCollectionUri.value}'")),
        _ => Attempt.Right(())
      )

      // Update Neo4j: move the ingestion to the new collection
      _ <- manifest.moveIngestionToCollection(ingestionUri, targetCollectionUri, newIngestionUri)
      _ = logger.info(s"Updated Neo4j relationships and properties")

      // Update Elasticsearch: Update all documents with the old ingestion path to the new one
      _ <- index.updateIngestionPath(ingestionUri.value, newIngestionUri.value)
      _ = logger.info(s"Updated Elasticsearch documents")

      _ = logger.info(s"Successfully moved ingestion from ${ingestionUri.value} to ${newIngestionUri.value}")
    } yield newIngestionUri
  }
}
