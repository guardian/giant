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


class DeleteResource( manifest: Manifest, index: Index, previewStorage: ObjectStorage, objectStorage: ObjectStorage, previewService: PreviewService)  (implicit ec: ExecutionContext)
   {

     private def deletePagePreviews(uri: Uri, languages: List[Language]): Attempt[List[Unit]] = {
       val pagePreviewPrefixes = languages.map(PreviewService.getPageStoragePrefix(uri, _))
       val listOfPagePreviewObjectsAttempts = pagePreviewPrefixes.map { prefix =>
         Attempt.fromEither(previewStorage.list(prefix))
       }
       val pagePreviewObjectsAttempt = Attempt.sequence(listOfPagePreviewObjectsAttempts).map(_.flatten)

       pagePreviewObjectsAttempt.flatMap { pagePreviewObjects =>
         val deletionAttempts = pagePreviewObjects
           .map(previewStorage.delete)
           .map(Attempt.fromEither)

         Attempt.sequence(deletionAttempts)
       }
     }

     private def deleteResource(uri: Uri, deleteFolders: Boolean): Attempt[Unit] = {
       val successAttempt = Attempt.Right(())
       for {
         languages <- manifest.getOcrLanguages(uri)
         // Not everything has a preview but S3 returns success for deleting an object that doesn't exist so we're fine
         _ <- deletePagePreviews(uri, languages)
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
