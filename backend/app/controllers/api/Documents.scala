package controllers.api

import commands._
import model.Uri
import play.api.mvc._
import services.ObjectStorage
import services.annotations.Annotations
import services.index.Index
import services.manifest.Manifest
import services.users.UserManagement
import utils.Logging
import utils.attempt.Attempt
import utils.controller.{OptionalAuthApiController, AuthControllerComponents, ResourceDownloadHelper}

import scala.concurrent.duration._

class Documents(override val controllerComponents: AuthControllerComponents,
                val manifest: Manifest, val index: Index, blobStorage: ObjectStorage, val users: UserManagement,
                val annotations: Annotations, val downloadExpiryPeriod: FiniteDuration)
  extends OptionalAuthApiController with Logging with ResourceDownloadHelper {

  def authoriseDownload(uri: Uri) = auth.ApiAction.attempt { implicit req =>
    logger.info(s"Authorising download of ${uri}")

    // Access permissions are currently checked inside the AuthoriseDownload command
    AuthoriseDownload(uri, routes.Documents.actualDownload(uri))
  }

  def actualDownload(uri: Uri) = noAuth.ApiAction.attempt { implicit request: RequestHeader =>
    authorisedToDownload {
      for {
        blob <- GetBlobObjectData(uri, manifest, blobStorage).process().toAttempt
        resource <- Attempt.fromEither(manifest.getResource(uri))
      } yield {
        val filename = request.queryString.getOrElse("filename", Seq(resource.parents.head.uri.split('/').last)).head

        // Use the RangeResult API since it understands how to encode non-ascii filenames (even though this isn't a partial response)
        // Play will close the InputStream for us once it's done
        RangeResult.ofStream(
          entityLength = blob.metadata.size,
          stream = blob.data,
          fileName = filename,
          rangeHeader = None,
          contentType = Some(blob.metadata.mimeType)
        )
      }
    }
  }
}
