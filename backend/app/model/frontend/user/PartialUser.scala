package model.frontend.user

import play.api.libs.json.{Format, Json}

/* User model for sending users to and from the SPA */
case class PartialUser(username: String, displayName: String)

object PartialUser {
  implicit val userFormat: Format[PartialUser] = Json.format[PartialUser]
}
