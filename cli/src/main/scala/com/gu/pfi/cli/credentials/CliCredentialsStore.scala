package com.gu.pfi.cli.credentials

import java.net.URLEncoder
import java.nio.file.{Files, Path, Paths}
import java.util.concurrent.atomic.AtomicReference

import com.gu.pfi.cli.service.CliFiles
import play.api.libs.json.Json
import utils.attempt._

import scala.concurrent.ExecutionContext

class CliCredentialsStore(implicit ec: ExecutionContext) {
  private val storePath = Paths.get(System.getProperty("user.home")).resolve(".pfi-token")
  private val cachedCredentials = new AtomicReference[Option[CliCredentials]](None)

  mkdir(storePath)

  def get(baseUri: String): Attempt[Option[CliCredentials]] = {
    cachedCredentials.get() match {
      case Some(creds) =>
        Attempt.Right(Some(creds))

      case None =>
        val file = filePath(baseUri)
        val fileExists = Attempt.catchNonFatalBlasé {
          Files.exists(file)
        }

        fileExists.flatMap {
          case true =>
            CliFiles.readFile(file).flatMap { raw =>
              val json = Json.parse(raw)
              val credentials = json.validate[CliCredentials]

              credentials.toAttempt.map(Some(_))
            }

          case false =>
            Attempt.Right[Option[CliCredentials]](None)
        }
    }
  }

  def put(baseUri: String, credentials: CliCredentials): Attempt[Unit] = {
    cachedCredentials.set(Some(credentials))

    val file = filePath(baseUri)
    CliFiles.writeFile(file, Json.stringify(Json.toJson(credentials)))
  }

  def delete(baseUri: String): Attempt[Unit] = Attempt.catchNonFatalBlasé {
    val file = filePath(baseUri)
    Files.delete(file)
  }

  private def filePath(baseUri: String): Path = {
    storePath.resolve(URLEncoder.encode(baseUri, "UTF-8"))
  }

  private def mkdir(storePath: Path): Unit = {
    if(!Files.exists(storePath)) {
      Files.createDirectories(storePath)
    } else if(!Files.isDirectory(storePath)) {
      throw new IllegalStateException(s"$storePath already exists and is not a directory")
    }
  }
}
