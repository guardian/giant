package model.manifest

import model.user.UserPermissions
import play.api.libs.json.{Json, OFormat}

case class UserWithCollections(username: String, displayName: String, collections: List[String], permissions: UserPermissions)
object UserWithCollections {
  implicit val userFormat: OFormat[UserWithCollections] = Json.format[UserWithCollections]
}
