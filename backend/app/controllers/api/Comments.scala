package controllers.api

import java.nio.charset.StandardCharsets

import commands.{GetResource, ResourceFetchMode}
import model.Uri
import model.annotations.CommentAnchor
import model.frontend.{Resource => ModelResource}
import play.api.libs.json._
import play.utils.UriEncoding
import services.annotations.Annotations
import services.index.Index
import services.manifest.Manifest
import utils.attempt.{Attempt, ClientFailure}
import utils.controller.{AuthApiController, AuthControllerComponents}

import scala.concurrent.ExecutionContext

case class PostCommentData(text: String, anchor: Option[CommentAnchor])
object PostCommentData {
  implicit val format = Json.format[PostCommentData]
}

class Comments(override val controllerComponents: AuthControllerComponents,
  manifest: Manifest,
  index: Index,
  annotation: Annotations)(implicit ex: ExecutionContext) extends AuthApiController {

  def postComment(uri: Uri) = ApiAction.attempt(parse.json) { req =>
    val data = req.body.as[PostCommentData]

    def isValidForComments(r: ModelResource): Attempt[Unit] = {
      if (r.`type` == "blob" || r.`type` == "email") {
        Attempt.Right(())
      }  else {
        Attempt.Left(ClientFailure(s"Cannot add comment to resource type: ${r.`type`}"))
      }
    }

    val decodedUri = Uri(UriEncoding.decodePath(uri.value, StandardCharsets.UTF_8))
    for {
      // Does permissions checking
      r <- GetResource(decodedUri, ResourceFetchMode.Basic, req.user.username, manifest, index, annotation, controllerComponents.users).process()
      _ <- isValidForComments(r)
      _ <- annotation.postComment(req.user.username, uri, data.text, data.anchor)
      // TODO add to index
    } yield NoContent
  }

  def getCommentsForBlob(uri: Uri) = ApiAction.attempt { req =>
    val decodedUri = Uri(UriEncoding.decodePath(uri.value, StandardCharsets.UTF_8))
    for {
      _ <- GetResource(decodedUri, ResourceFetchMode.Basic, req.user.username, manifest, index, annotation, controllerComponents.users).process()
      comments <- annotation.getComments(uri)
    } yield Ok(Json.toJson(comments))
  }

  def deleteComment(commentId: String) = ApiAction.attempt { req =>
    // TODO MRB: how would we do permissions checking for deleting a comment?
    annotation.deleteComment(req.user.username, commentId).map(_ => NoContent)
  }
}
