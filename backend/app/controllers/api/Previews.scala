package controllers.api

import akka.stream.scaladsl.StreamConverters
import model.{ObjectData, ObjectMetadata, Uri}
import play.api.http.HttpEntity
import play.api.mvc._
import services.annotations.Annotations
import services.index.Index
import services.manifest.Manifest
import services.previewing.PreviewService
import services.users.UserManagement
import utils.attempt.Attempt
import utils.controller.{OptionalAuthApiController, AuthControllerComponents, ResourceDownloadHelper}

import scala.concurrent.duration._

class Previews(override val controllerComponents: AuthControllerComponents, val manifest: Manifest, val index: Index,
               previews: PreviewService, val users: UserManagement, val annotations: Annotations, val downloadExpiryPeriod: FiniteDuration)
  extends OptionalAuthApiController with ResourceDownloadHelper {

  def getPreviewMetadata(uri: Uri) = auth.ApiAction.attempt { req =>
    checkResource(req.user.username, uri.value).flatMap { _ =>
      for {
        mimeType <- previews.getPreviewType(uri)
      } yield {
        Result(ResponseHeader(200), HttpEntity.NoEntity.as(mimeType))
      }
    }
  }

  def getPreview(uri: Uri) = auth.ApiAction.attempt { req =>
    checkResource(req.user.username, uri.value).flatMap { _ =>
      downloadResult(uri, filename = None, rangeHeader = None)
    }
  }

  def generatePreview(uri: Uri) = auth.ApiAction.attempt { req =>
    checkResource(req.user.username, uri.value).flatMap { _ =>
      previews.generatePreview(uri).map { _ => NoContent }
    }
  }

  def authoriseDownload(uri: Uri) = auth.ApiAction.attempt { implicit request =>
    AuthoriseDownload(uri, routes.Previews.preAuthorizedDownload(uri))
  }

  def preAuthorizedDownload(uri: Uri) = noAuth.ApiAction.attempt { implicit request: RequestHeader =>
    val filename = request.queryString.get("filename").flatMap(_.headOption)

    authorisedToDownload {
      downloadResult(uri, filename, request.headers.get(RANGE))
    }
  }

  private def downloadResult(uri: Uri, filename: Option[String], rangeHeader: Option[String]): Attempt[Result] = {
    previews.getPreviewObject(uri).map {
      case ObjectData(data, ObjectMetadata(size, mimeType)) =>
        // RangeResult comes from Play and expects source to be an akka Source so we use akka here rather than pekko
        val source = StreamConverters.fromInputStream(() => data)

        // The RangeResult API understands how to encode non-ascii filenames
        RangeResult.ofSource(
          source = source,
          entityLength = Some(size),
          fileName = filename,
          rangeHeader = rangeHeader,
          contentType = Some(mimeType)
        ).withHeaders(
          "X-Frame-Options" -> "SAMEORIGIN"
        )
    }
  }
}