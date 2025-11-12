package model.frontend

import play.api.libs.json.{Format, Json}

case class TotpActivation(secret: String, code: String)
object TotpActivation {
  implicit val formats: Format[TotpActivation] = Json.format[TotpActivation]
}
