package commands

import model.{Language, Uri}
import play.api.mvc.Result
import play.api.mvc.Results.NoContent
import services.ObjectStorage
import services.index.Index
import services.manifest.Manifest
import services.previewing.PreviewService
import utils.Logging
import utils.attempt.{Attempt, DeleteFailure, IllegalStateFailure}

import scala.concurrent.ExecutionContext


class DeleteResource( manifest: Manifest, index: Index, previewStorage: ObjectStorage, objectStorage: ObjectStorage)  (implicit ec: ExecutionContext)
   extends Logging {

     private def deletePagePreviewObjects(s3Objects: List[String], s3Prefixes: List[String]): Attempt[List[Unit]] = {
       if (s3Objects.length < s3Prefixes.length) {
         // If this sanity check fails, we will bail out of the entire delete
         // operation to avoid leaving things in a partially deleted state.
         Attempt.Left(IllegalStateFailure(s"Only found ${s3Objects.length} object(s) under ${s3Prefixes.length} prefixes"))
       } else {
         logger.info(s"Deleting objects: ${s3Objects.mkString(", ")}")
         val deletionAttempts = s3Objects
           .map(previewStorage.delete)
           .map(Attempt.fromEither)

         Attempt.sequence(deletionAttempts)
       }
     }

     private def deletePagePreviews(uri: Uri, ocrLanguages: List[Language]): Attempt[List[Unit]] = {
       if (ocrLanguages.isEmpty) {
         // This typically means the blob was not processed by the OcrMyPdfExtractor,
         // either because it's not a PDF or because it was processed before
         // we introduced the OcrMyPdfExtractor.
         logger.info(s"No OCR languages found for blob ${uri.value}")
       } else {
         logger.info(s"Deleting page previews for ${uri.value} in languages: ${ocrLanguages.map(_.key).mkString(", ")}")
       }

       val pagePreviewPrefixes = ocrLanguages.map(PreviewService.getPageStoragePrefix(uri, _))
       logger.info(s"Deleting prefixes: ${pagePreviewPrefixes.mkString(", ")}")

       val listOfPagePreviewObjectsAttempts = pagePreviewPrefixes.map { prefix =>
         Attempt.fromEither(previewStorage.list(prefix))
       }
       val pagePreviewObjectsAttempt = Attempt.sequence(listOfPagePreviewObjectsAttempts).map(_.flatten)

       pagePreviewObjectsAttempt.flatMap(deletePagePreviewObjects(_, pagePreviewPrefixes))
     }

     private def deleteResource(uri: Uri, deleteFolders: Boolean): Attempt[Unit] = {
       val successAttempt = Attempt.Right(())
       for {
         // For blobs not processed by the OcrMyPdfExtractor, ocrLanguages will be an empty list
         ocrLanguages <- manifest.getLanguagesProcessedByOcrMyPdf(uri)
         // Not everything has a preview but S3 returns success for deleting an object that doesn't exist so we're fine
         _ <- deletePagePreviews(uri, ocrLanguages)
         _ <- Attempt.fromEither(previewStorage.delete(uri.toStoragePath))
         _ <- Attempt.fromEither(objectStorage.delete(uri.toStoragePath))
         _ <- index.delete(uri.value)
         _ <- if (deleteFolders) manifest.deleteBlobFileParent(uri) else successAttempt
         // not all blobs are in workspaces so ignore failures here
         _ <- if (deleteFolders) manifest.deleteBlobWorkspaceNode(uri).recoverWith{ case _ => successAttempt} else successAttempt
         _ <- manifest.deleteBlob(uri)
         _ <- successAttempt
       } yield {
         Unit
       }
     }

     // Deletes resource after checking it has no child nodes
     def deleteBlobCheckChildren(id: String, deleteFolders: Boolean): Attempt[_ <: Unit] = {
       val uri = Uri(id)

       // casting to an option here because Attempt[Resource] and Attempt[Unit] are incompatible - so can't use a for comprehension with toAttempt
       val deleteResult = manifest.getResource(uri).toOption map { resource =>
         if (resource.children.isEmpty) deleteResource(uri, deleteFolders)
         else Attempt.Left(IllegalStateFailure(s"Cannot delete $uri as it has child nodes"))
       }
       deleteResult.getOrElse(Attempt.Left(DeleteFailure("Failed to fetch resource")))
     }

     def deleteBlob(id: String, deleteFolders: Boolean): Attempt[Unit] = {
       val uri = Uri(id)
       deleteResource(uri, deleteFolders)
     }

   }
