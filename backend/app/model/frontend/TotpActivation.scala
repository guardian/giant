package model.frontend

import play.api.libs.json.Json

case class TotpActivation(secret: String, code: String)
object TotpActivation {
  implicit val formats = Json.format[TotpActivation]
}
