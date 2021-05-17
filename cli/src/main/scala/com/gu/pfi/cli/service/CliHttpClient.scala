package com.gu.pfi.cli.service

import java.io.IOException
import java.util.Scanner

import com.gu.pfi.cli.credentials.{CliCredentials, CliCredentialsStore}
import okhttp3._
import play.api.libs.json.{JsNull, JsValue, Json}
import utils.Logging
import utils.attempt._

import scala.concurrent.{ExecutionContext, Promise}

object CliHttpClient {
  val authHeader = "Authorization"
  val offerAuthHeader = "X-Offer-Authorization"
  val wwwAuthenticateHeader = "WWW-Authenticate"
  val jsonMimeType = MediaType.parse("application/json")
}

class CliHttpClient(client: OkHttpClient, credsStore: CliCredentialsStore, baseUri: String)(implicit ec: ExecutionContext) extends Logging {
  import CliHttpClient._

  def getCredentials: Attempt[CliCredentials] = {
    for {
      _ <- get("/api/keepalive")
      maybeCredentials <- credsStore.get(baseUri)
      token <- maybeCredentials.toAttempt(Attempt.Left(AuthenticationFailure("Not logged in", reportAsFailure = false)))
    } yield token
  }

  def get(path: String): Attempt[JsValue] = {
    run(path).map { r =>
      val stringBody = r.body().string()
      if (stringBody.isEmpty) {
        JsNull
      } else {
        Json.parse(stringBody)
      }
    }
  }

  def post(path: String, body: String, mimeType: MediaType = jsonMimeType): Attempt[Response] = {
    run(path, "POST", Some(RequestBody.create(mimeType, body)))
  }

  def put(path: String, body: String, mimeType: MediaType = jsonMimeType): Attempt[Response] = {
    run(path, "PUT", Some(RequestBody.create(mimeType, body)))
  }

  def delete(path: String): Attempt[Response] = {
    run(path, "DELETE")
  }

  def login(username: Option[String], password: Option[String], tfa: Option[String], maybeToken: Option[String]): Attempt[Unit] = {
    maybeToken match {
      case None =>
        requestToken(username, password, tfa).map(_ => ())
      case Some(token) =>
        verifyAndSaveToken(token).map(_ => ())
    }
  }

  def logout(): Attempt[Unit] = {
    delete("/api/auth/token").flatMap(_ => credsStore.delete(baseUri))
  }

  private def run(path: String, method: String = "GET", body: Option[RequestBody] = None): Attempt[Response] = {
    val existingToken = credsStore.get(baseUri)
      .flatMap(_.map(Attempt.Right).getOrElse(requestToken()))

    def makeRequest(credentials: CliCredentials) = {
      val request = new Request.Builder()
        .url(baseUri + path)
        .addHeader(authHeader, credentials.authorization)
        .method(method, body.orNull)
        .build()

      execute(request)
    }

    def handleResponse(response: Response, retry: Boolean): Attempt[Response] = {
      response.code() match {
        case 200 | 201 | 204 =>
          Option(response.header(offerAuthHeader)) match {
            case Some(token) =>
              saveCredentials(CliCredentials(token)).map(_ => response)

            case None =>
              Attempt.Right(response)
          }

        case 401 if retry =>
          requestToken().flatMap(makeRequest).flatMap(handleResponse(_, retry = false))

        case _ =>
          Attempt.Left(IllegalStateFailure(s"${response.code()} ${response.body().string()}"))
      }
    }

    existingToken.flatMap(makeRequest).flatMap(handleResponse(_, retry = true))
  }

  private def requestToken(maybeUsername: Option[String] = None, maybePassword: Option[String] = None,
                           maybeTfa: Option[String] = None): Attempt[CliCredentials] = {
    val username = maybeUsername.getOrElse(readParam("username"))
    val password = maybePassword.getOrElse(readParam("password", noEcho = true))

    val formBody = new FormBody.Builder().add("username", username).add("password", password)
    val formBodyMaybeTfa = maybeTfa.map(tfa => formBody.add("tfa", tfa)).getOrElse(formBody)
    val request = new Request.Builder().url(baseUri + "/api/auth/token").method("POST", formBodyMaybeTfa.build()).build()

    execute(request).flatMap { response =>
      (Option(response.header(offerAuthHeader)), Option(response.header(wwwAuthenticateHeader))) match {
        case (Some(token), None) =>
          saveCredentials(CliCredentials(token))

        case (_, Some("Pfi2fa")) =>
          val tfaToken = readParam("2FA code")
          requestToken(Some(username), Some(password), Some(tfaToken))

        case _ =>
          Attempt.Left(AuthenticationFailure(response.body().string(), reportAsFailure = false))
      }
    }
  }

  private def verifyAndSaveToken(seedToken: String): Attempt[CliCredentials] = {
    // check that this token is valid by hitting a read only endpoint
    val credentials = CliCredentials(if (seedToken.startsWith("Bearer ")) seedToken else s"Bearer $seedToken")
    val request = new Request.Builder()
      .url(baseUri + "/api/keepalive")
      .addHeader(authHeader, credentials.authorization)
      .get()
      .build()

    execute(request)
      .flatMap { response =>
        (Option(response.header(offerAuthHeader)), Option(response.header(wwwAuthenticateHeader))) match {
          case (Some(newToken), None) =>
            saveCredentials(CliCredentials(newToken))

          case _ =>
            Attempt.Left(AuthenticationFailure(response.body().string(), reportAsFailure = false))
        }
      }
  }

  private def readParam(name: String, noEcho: Boolean = false): String = {
    val fallbackInput = new Scanner(System.in)
    val fallbackWarning = if(noEcho) { "(password input will not be hidden!)" } else { "" }

    Option(System.console()) match {
      case Some(console) if noEcho =>
        new String(console.readPassword(s"$name: "))

      case Some(console) =>
        console.readLine(s"$name: ")

      case None =>
        // we don't have a proper shell when running in the IDE so we can't hide (sad face)
        logger.error(s"$name: $fallbackWarning")
        fallbackInput.next()
    }
  }

  private def saveCredentials(credentials: CliCredentials): Attempt[CliCredentials] = {
    credsStore.put(baseUri, credentials).map(_ => credentials)
  }

  private def execute(request: Request): Attempt[Response] = {
    val ret = Promise[Response]()

    client.newCall(request).enqueue(new Callback {
      override def onResponse(call: Call, response: Response): Unit = {
        ret.success(response)
      }

      override def onFailure(call: Call, e: IOException): Unit = {
        ret.failure(e)
      }
    })

    Attempt.fromFutureBlasé(ret.future)
  }
}
