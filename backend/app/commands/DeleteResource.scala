package commands

import model.{Language, Uri}
import play.api.mvc.Result
import play.api.mvc.Results.NoContent
import services.ObjectStorage
import services.index.Index
import services.manifest.Manifest
import services.previewing.PreviewService
import utils.{Logging, Timing}
import utils.attempt.{Attempt, DeleteFailure, IllegalStateFailure}

import scala.concurrent.ExecutionContext


class DeleteResource( manifest: Manifest, index: Index, previewStorage: ObjectStorage, objectStorage: ObjectStorage)  (implicit ec: ExecutionContext)
   extends Timing {

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

       val listOfPagePreviewObjectsAttempts = prefixesToDelete.map { prefix =>
         Attempt.fromEither(previewStorage.list(prefix))
       }
       Attempt.sequence(listOfPagePreviewObjectsAttempts).map(_.flatten.toSet)
     }

     private def deleteResource(uri: Uri): Attempt[Unit] = timeAsync("Total to delete resource", {
       val successAttempt = Attempt.Right(())
       for {
         // For blobs not processed by the OcrMyPdfExtractor, ocrLanguages will be an empty list
         ocrLanguages <- timeAsync("Getting langs from neo4j", manifest.getLanguagesProcessedByOcrMyPdf(uri))
         // Not everything has a preview but S3 returns success for deleting an object that doesn't exist so we're fine
         pagePreviewS3Keys <- timeAsync("Get page preview S3 keys", getPagePreviewS3Keys(uri, ocrLanguages))
         _ <- timeAsync("Preview storage S3 delete", deleteFromS3Preview(uri, pagePreviewS3Keys))
         _ <- Attempt.fromEither(timeSync("Ingest storage S3 delete", objectStorage.delete(uri.toStoragePath)))
         _ <- timeAsync("Delete blob from neo4j", manifest.deleteBlob(uri))
         // We use the index to determine what blobs are in a collection.
         // So we should delete from the index last, so that if any of the above
         // operations fails, we are still able to clear things up
         // by restarting the delete collection operation. (Otherwise,
         // it would think the blob no longer exists even though there may
         // be traces in neo4j or S3).
         _ <- timeAsync("Delete blob from elasticsearch", index.delete(uri.value))
         _ <- successAttempt
       } yield {
         ()
       }
     })

     // Deletes resource after checking it has no child nodes
     def deleteBlobCheckChildren(id: String): Attempt[_ <: Unit] = {
       val uri = Uri(id)

       // casting to an option here because Attempt[Resource] and Attempt[Unit] are incompatible - so can't use a for comprehension with toAttempt
       val deleteResult = manifest.getResource(uri).toOption map { resource =>
         if (resource.children.isEmpty) deleteResource(uri)
         else Attempt.Left(IllegalStateFailure(s"Cannot delete $uri as it has child nodes"))
       }
       deleteResult.getOrElse(Attempt.Left(DeleteFailure("Failed to fetch resource")))
     }

     def deleteBlob(id: String): Attempt[Unit] = {
       val uri = Uri(id)
       deleteResource(uri)
     }

   }
