package model.user

import play.api.libs.json._

case class BCryptPassword(hash: String) extends AnyVal

object BCryptPassword {
  implicit val BCryptPasswordFormat = new Format[BCryptPassword] {
    def writes(password: BCryptPassword): JsValue = JsString(password.hash)
    def reads(json: JsValue): JsResult[BCryptPassword] = Reads.StringReads.reads(json).map(BCryptPassword.apply)
  }
}