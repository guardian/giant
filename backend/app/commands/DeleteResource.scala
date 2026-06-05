package commands

import model.{Language, Uri}
import play.api.mvc.Result
import play.api.mvc.Results.NoContent
import services.ObjectStorage
import services.index.Index
import services.manifest.Manifest
import services.observability.PostgresClient
import services.previewing.PreviewService
import utils.{Logging, Timing}
import utils.attempt.{Attempt, DeleteFailure, Failure, IllegalStateFailure}

import scala.concurrent.{ExecutionContext, Future}


class DeleteResource( manifest: Manifest, index: Index, previewStorage: ObjectStorage, objectStorage: ObjectStorage, postgresClient: PostgresClient)  (implicit ec: ExecutionContext)
   extends Timing {

     // Run a blocking, Either-returning IO call (Postgres/S3 SDK) on a Future so it can overlap
     // with other independent deletions rather than blocking the calling thread in sequence.
     private def deferEither[A](block: => Either[Failure, A]): Attempt[A] =
       Attempt.async.Right(Future(block)).flatMap(Attempt.fromEither)

     private def deleteFromS3Preview(blobUri: Uri, pagePreviewKeys: Set[String]): Attempt[Iterator[Unit]] = {
       // The full-document preview, as well as all the previews of individual pages
       val keys = pagePreviewKeys + blobUri.toStoragePath
       logger.info(s"Deleting ${keys.size} objects from preview storage")

       // Group, just in case we have thousands of pages.
       // 1000 objects is the limit for a batch:
       // https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html
       Attempt.traverse(keys.grouped(500)) { batchOfS3Keys =>
         Attempt.fromEither(previewStorage.deleteMultiple(batchOfS3Keys))
       }
     }

     private def getPagePreviewS3Keys(uri: Uri, ocrLanguages: List[Language]): Attempt[Set[String]] = {
       if (ocrLanguages.isEmpty) {
         // This typically means the blob was not processed by the OcrMyPdfExtractor,
         // either because it's not a PDF or because it was processed before
         // we introduced the OcrMyPdfExtractor.
         logger.info(s"No OCR languages found for blob ${uri.value}")
       } else {
          logger.info(s"Deleting page previews for ${uri.value} in languages: ${ocrLanguages.map(_.key).mkString(", ")}")
       }

       // Try and delete from these legacy paths as well.
       // If there's nothing under them, we just won't find any objects and there will be nothing extra to delete.
       // We can delete this code once we've delete or reprocessed everything under these folders.
       val legacyPagePreviewPrefixes = List("ocr.english", "text").map(folder => s"pages/${folder}/${uri.toStoragePath}")
       val pagePreviewPrefixes = ocrLanguages.map(PreviewService.getPageStoragePrefix(uri, _))
       val prefixesToDelete = legacyPagePreviewPrefixes ::: pagePreviewPrefixes
        logger.info(s"Deleting prefixes: ${prefixesToDelete.mkString(", ")}")

       // Start every prefix LIST eagerly so the independent S3 round-trips run concurrently,
       // then join (sequence preserves the first failure).
       val listings = prefixesToDelete.map(prefix => deferEither(previewStorage.list(prefix)))
       Attempt.sequence(listings).map(_.flatten.toSet)
     }

     private def deleteResource(uri: Uri): Attempt[Unit] = timeAsync("Total to delete resource", {
       // The Postgres cleanup, the ingest-object delete, and the OCR-languages read are mutually
       // independent. Assign them to vals so their Futures start immediately and run concurrently.
       val deletePostgres = deferEither(
         timeSync("Deleting blob observability events", postgresClient.deleteBlobIngestionEventsAndMetadata(uri.value)))
       val deleteIngestS3 = deferEither(
         timeSync("Ingest storage S3 delete", objectStorage.delete(uri.toStoragePath)))
       // For blobs not processed by the OcrMyPdfExtractor, ocrLanguages will be an empty list
       val ocrLanguages = timeAsync("Getting langs from neo4j", manifest.getLanguagesProcessedByOcrMyPdf(uri))

       // The preview deletion and the Neo4j blob deletion both depend on the OCR languages
       // (we must read the languages before deleting the blob node and its PROCESSED edges),
       // but are independent of each other, so run them concurrently once the languages are known.
       val deletePreviewsAndBlob = ocrLanguages.flatMap { languages =>
         // Not everything has a preview but S3 returns success for deleting an object that doesn't exist so we're fine
         val deletePreviews = timeAsync("Get page preview S3 keys", getPagePreviewS3Keys(uri, languages))
           .flatMap(keys => timeAsync("Preview storage S3 delete", deleteFromS3Preview(uri, keys)))
         val deleteNeo4jBlob = timeAsync("Delete blob from neo4j", manifest.deleteBlob(uri))
         deletePreviews.zipWith(deleteNeo4jBlob)((_, _) => ())
       }

       for {
         // Join everything except the index before touching it.
         _ <- deletePostgres.zipWith(deleteIngestS3)((_, _) => ())
         _ <- deletePreviewsAndBlob
         // We use the index to determine what blobs are in a collection.
         // So we delete from the index last, so that if any of the above operations fails, we are
         // still able to clear things up by restarting the delete collection operation. (Otherwise,
         // it would think the blob no longer exists even though there may be traces in neo4j or S3).
         _ <- timeAsync("Delete blob from elasticsearch", index.delete(uri.value))
       } yield ()
     })

     // Deletes resource after checking it has no child nodes
     def deleteBlobCheckChildren(id: String): Attempt[Unit] = {
       val uri = Uri(id)

       // casting to an option here because Attempt[Resource] and Attempt[Unit] are incompatible - so can't use a for comprehension with toAttempt
       val deleteResult = manifest.getResource(uri).toOption map { resource =>
         if (resource.children.isEmpty) deleteResource(uri)
         else Attempt.Left[Unit](IllegalStateFailure(s"Cannot delete $uri as it has child nodes"))
       }
       deleteResult.getOrElse(Attempt.Left(DeleteFailure("Failed to fetch resource")))
     }

     def deleteBlob(id: String): Attempt[Unit] = {
       val uri = Uri(id)
       deleteResource(uri)
     }

   }
