package controllers.api

import org.apache.pekko.stream.scaladsl.StreamConverters
import org.apache.pekko.util.ByteString
import commands._
import model.frontend.{Chips, HighlightableText, ResourcesForExtractionFailureRequest}
import model.index.{FrontendPage, FrontendPageResult, Page, PageHighlight, PageResult}
import model.user.UserPermission.CanPerformAdminOperations
import model.{English, Language, Uri}
import org.apache.pdfbox.pdmodel.PDDocument
import play.api.http.HttpEntity
import play.api.libs.json._
import play.api.mvc.{ResponseHeader, Result}
import play.utils.UriEncoding
import services.{ObjectStorage, PreviewConfig}
import services.annotations.Annotations
import services.index.{Index, Pages}
import services.manifest.Manifest
import services.previewing.PreviewService
import utils.PDFUtil
import utils.attempt.{Attempt, IllegalStateFailure}
import utils.controller.{AuthApiController, AuthControllerComponents}

import java.io.{ByteArrayOutputStream, InputStream}
import java.nio.charset.StandardCharsets

case class FlagData(flagValue: String)

object FlagData {
  implicit val flagDataFormat: Format[FlagData] = Json.format[FlagData]
}

class Resource(val controllerComponents: AuthControllerComponents, manifest: Manifest,
               index: Index, pages: Pages, annotations: Annotations, previewStorage: ObjectStorage) extends AuthApiController {

  def getResource(uri: Uri, basic: Boolean, q: Option[String]) = ApiAction.attempt  { implicit req =>
    val parsedChips = q.map(Chips.parseQueryString)

    val resourceFetchMode = (basic, parsedChips) match {
      case (true, _) => ResourceFetchMode.Basic
      case (false, pc) => ResourceFetchMode.WithData(pc.map(_.query))
    }

    val decodedUri = Uri(UriEncoding.decodePath(uri.value, StandardCharsets.UTF_8))
    val command = GetResource(decodedUri, resourceFetchMode,
      req.user.username, manifest, index, annotations, controllerComponents.users)

    command.process().map {
      file => Ok(Json.toJson(file))
    }
  }

  // TODO MRB: filter by collection and ingestion by writing failures as events to Elasticsearch
  def getExtractionFailures = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      Attempt.fromEither {
        manifest.getFailedExtractions.map(failures => Ok(Json.toJson(failures)))
      }
    }
  }

  // This isn't conceptually a POST but we couldn't put the stack trace as a query parameter without it breaking the
  // default maximum size for them in Play. It would be better to attach an ID to each extraction failure but that
  // would be a breaking schema change
  def getResourcesForExtractionFailure(page: Int, pageSize: Int) = ApiAction.attempt(parse.json) { req =>
    checkPermission(CanPerformAdminOperations, req) {
      Attempt.fromEither {
        val request = req.body.as[ResourcesForExtractionFailureRequest]
        val skip = (page - 1) * pageSize

        val resources = manifest.getResourcesForExtractionFailure(request.extractorName, request.stackTrace, page, skip, pageSize)
        resources.map(r => Ok(Json.toJson(r)))
      }
    }
  }

  def getTextPages(uri: Uri, top: Double, bottom: Double, q: Option[String], language: Option[Language]) = ApiAction.attempt { req =>
    val parsedChips = q.map(Chips.parseQueryString)

    for {
      // Check we have permission to see this file
      _ <- GetResource(uri, ResourceFetchMode.Basic, req.user.username, manifest, index, annotations, controllerComponents.users).process()
      response <- new GetPages(uri, top, bottom, parsedChips.map(_.query), language, pages, previewStorage).process()
    } yield {
      Ok(Json.toJson(response))
    }
  }

  def getPagePreview(uri: Uri, language: Language, pageNumber: Int) = ApiAction.attempt { req =>
    for {
      // Check we have permission to see this file
      _ <- GetResource(uri, ResourceFetchMode.Basic, req.user.username, manifest, index, annotations, controllerComponents.users).process()
      response <- new GetPagePreview(uri, language, pageNumber, previewStorage).process()
    } yield {
      Result(ResponseHeader(200, Map.empty), response)
    }
  }
}
