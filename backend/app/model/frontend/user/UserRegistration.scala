package model.frontend.user

import model.frontend.TotpActivation
import play.api.libs.json.Json

case class UserRegistration(username: String, previousPassword: String, displayName: String, newPassword: String, totpActivation: Option[TotpActivation])

object UserRegistration {
  implicit val formats = Json.format[UserRegistration]
}
