package utils.auth

import play.api.libs.json.{Json, Reads}

case class Token(user: User, issuedAt: Long, refreshedAt: Long, exp: Long, loginExpiry: Long, verificationExpiry: Long)

object Token {
  val USER_KEY = "user"
  val ISSUED_AT_KEY = "issuedAt"
  val REFRESHED_AT_KEY = "refreshedAt"
  val LOGIN_EXPIRY_KEY = "loginExpiry"
  val VERIFICATION_EXPIRY_KEY = "verificationExpiry"
  val PERMISSIONS = "permissions"
  implicit val tokenReads: Reads[Token] = Json.reads[Token]
}