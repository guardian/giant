package model.user

import enumeratum._
import model.user.UserPermission.CanPerformAdminOperations
import play.api.libs.json.{Format, Json}

sealed trait UserPermission extends EnumEntry

object UserPermission extends PlayEnum[UserPermission] {
  val values = findValues

  case object CanPerformAdminOperations extends UserPermission
}

case class UserPermissions(granted: Set[UserPermission]) {
  def hasPermission(p: UserPermission): Boolean = granted.contains(p)
}

object UserPermissions {
  val default = UserPermissions(Set.empty)
  val bigBoss = UserPermissions(Set(CanPerformAdminOperations))

  implicit val format: Format[UserPermissions] = Json.format[UserPermissions]
}
