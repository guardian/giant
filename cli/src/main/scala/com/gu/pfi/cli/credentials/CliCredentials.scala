package com.gu.pfi.cli.credentials

import java.nio.charset.StandardCharsets
import java.util.Base64

import com.auth0.jwt.JWT
import play.api.libs.json.{Format, Json}
import utils.VersionedFormat

case class CliCredentials(authorization: String)
case class DecodedCliCredentials(issuedAt: Long, refreshedAt: Long, exp: Long)

object DecodedCliCredentials {
  implicit val format: Format[DecodedCliCredentials] = Json.format[DecodedCliCredentials]
}

object CliCredentials extends VersionedFormat[CliCredentials] {
  override val current = Json.format[CliCredentials]

  def decode(credentials: CliCredentials): DecodedCliCredentials = {
    val encoded = credentials.authorization.split("Bearer")(1)

    val decodedBase64 = JWT.decode(encoded).getPayload
    val decoded = new String(Base64.getDecoder.decode(decodedBase64), StandardCharsets.UTF_8)
    val json = Json.parse(decoded)

    json.as[DecodedCliCredentials]
  }
}
