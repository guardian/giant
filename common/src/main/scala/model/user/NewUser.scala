package model.user

import play.api.libs.json.{Format, Json}

// This is used when an admin creates the skeleton of a user
case class NewUser(username: String, password: String)

object NewUser {
  implicit val newUserFormat: Format[NewUser] = Json.format[NewUser]
}
