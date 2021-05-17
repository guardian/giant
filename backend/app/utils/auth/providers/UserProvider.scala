package utils.auth.providers

import model.frontend.user.PartialUser
import model.frontend.TotpActivation
import play.api.libs.json._
import play.api.mvc.{AnyContent, Request}
import services.AuthProviderConfig
import utils.attempt._
import utils.auth.totp.TfaToken
import utils.Epoch

/**
  * A trait that authenticates a user
  */
trait UserProvider {
  /** The configuration for this user provider **/
  def config: AuthProviderConfig
  /** the configuration that is shipped to the UI for enhancements like client side minimum password length checks etc. **/
  def clientConfig: Map[String, JsValue]
  /** authenticate a user based on the HTTP request and the current time (for any 2FA calculations) **/
  def authenticate(request: Request[AnyContent], time: Epoch): Attempt[PartialUser]
  /** generate a brand new 2FA secret ready for a user to add to their device **/
  def generate2faToken(username: String, instance: String): Attempt[TfaToken]
  /** create an all powerful initial user **/
  def genesisUser(request: JsValue, time: Epoch): Attempt[PartialUser]
  /** create a new user account */
  def createUser(username: String, request: JsValue): Attempt[PartialUser]
  /** register a user (set up password/2FA) that has already been created by an admin **/
  def registerUser(request: JsValue, time: Epoch): Attempt[Unit]
  /** delete and disable a user account **/
  def removeUser(username: String): Attempt[Unit]
  /** update the password of a user **/
  def updatePassword(username: String, newPassword: String): Attempt[Unit]
  /** setup 2FA on an existing account that doesn't have it enabled **/
  def enrollUser2FA(username: String, totpActivation: TotpActivation, time: Epoch): Attempt[Unit]
  /** disable 2FA (if possible) **/
  def removeUser2FA(username: String): Attempt[Unit]
}