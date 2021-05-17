package utils.controller

import java.net.URLEncoder
import java.nio.charset.StandardCharsets

import commands.{GetResource, ResourceFetchMode}
import model.Uri
import play.api.mvc._
import play.utils.UriEncoding
import services.annotations.Annotations
import services.index.Index
import utils.Logging
import utils.attempt.{Attempt, AuthenticationFailure}

import scala.concurrent.ExecutionContext
import scala.concurrent.duration.FiniteDuration
import scala.util.Try
import services.manifest.Manifest
import services.users.UserManagement
import utils.auth.UserIdentityRequest

trait DownloadHelper extends Logging {
  def checkResource(username: String, url: String)(implicit ec: ExecutionContext): Attempt[Unit]
  def downloadExpiryPeriod: FiniteDuration

  private def downloadSessionKeyPrefix: String = "dwnldAuth:"
  protected def makeSessionKey(target: String) = s"$downloadSessionKeyPrefix$target"

  def AuthoriseDownload(resourceUri: Uri, target: Call)(implicit request: UserIdentityRequest[_], ec: ExecutionContext): Attempt[Result] = {
    val filename = request.queryString.get("filename").map(_.head)
    val now = System.currentTimeMillis()

    checkResource(request.user.username, resourceUri.value).map { _ =>
      logger.info(s"Authorised download of '${resourceUri.value}' as '${filename}' via ${target.url} by ${request.user.username}")
      authoriseDownload(target.url, filename, now, request.session)
    }.recoverWith {
      case err =>
        logger.warn(s"Disallowed download of '${resourceUri.value}' as '${filename}' via ${target.url} by ${request.user.username}: $err")
        Attempt.Left(err)
    }
  }

  def authoriseDownload(target: String, filename: Option[String], now: Long, session: Session): Result = {
    val fullTarget = filename.map(target + "?filename=" + URLEncoder.encode(_, "UTF-8")).getOrElse(target)
    val sessionKey = makeSessionKey(fullTarget)
    val exp = now + downloadExpiryPeriod.toMillis
    val newSession = session + (sessionKey -> exp.toString)

    Results.Ok(fullTarget).withSession(newSession)
  }

  def authorisedToDownload(block: => Attempt[Result])
                          (implicit request: RequestHeader, ec: ExecutionContext): Attempt[Result] = {

    val (authResult, newSession) = authorisedToDownload(request.uri, request.session, System.currentTimeMillis())

    val failureOrResult = authResult match {
      case Some(true) =>
        block
      case Some(false) =>
        Attempt.Left(AuthenticationFailure("Download session key expired or missing", reportAsFailure = true))
      case None =>
        Attempt.Left(AuthenticationFailure("Download session key missing", reportAsFailure = true))
    }

    failureOrResult.map(_.withSession(newSession))
  }

  def authorisedToDownload(uri: String, session: Session, now: Long): (Option[Boolean], Session) = {
    val sessionKey = makeSessionKey(uri)
    logger.info(s"Reconstructed session key from URL: $sessionKey")

    val result = session.get(sessionKey).flatMap(exp => Try(exp.toLong).toOption) match {
      case Some(exp) if exp > now =>
        Some(true)

      case Some(exp) =>
        Some(false)

      case _ =>
        None
    }

    val newSession = removeExpiredDownloadKeys(session, now)

    (result, newSession)
  }

  private def removeExpiredDownloadKeys(session: Session, now: Long): Session =
    Session(session.data.filterNot { case (key, value) =>
      key.startsWith(downloadSessionKeyPrefix) && Try(value.toLong).toOption.exists(_ < now)
    })
}

trait ResourceDownloadHelper extends DownloadHelper {
  def manifest: Manifest
  def index: Index
  def annotations: Annotations
  def users: UserManagement

  final override def checkResource(username: String, url: String)(implicit ec: ExecutionContext): Attempt[Unit] = {
    val decodedUri = Uri(UriEncoding.decodePath(url, StandardCharsets.UTF_8))
    GetResource(decodedUri, ResourceFetchMode.Basic, username, manifest, index, annotations, users).process().map(_ => ())
  }
}
