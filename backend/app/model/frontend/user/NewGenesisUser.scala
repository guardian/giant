package model.frontend.user

import model.frontend.TotpActivation
import play.api.libs.json.Json

case class NewGenesisUser(username: String, displayName: String, password: String, totpActivation: Option[TotpActivation])

object NewGenesisUser {
  implicit val genesisUserFormat = Json.format[NewGenesisUser]
}
