package model.frontend.user

import model.frontend.TotpActivation
import play.api.libs.json.{Format, Json}

case class NewGenesisUser(username: String, displayName: String, password: String, totpActivation: Option[TotpActivation])

object NewGenesisUser {
  implicit val genesisUserFormat: Format[NewGenesisUser] = Json.format[NewGenesisUser]
}
