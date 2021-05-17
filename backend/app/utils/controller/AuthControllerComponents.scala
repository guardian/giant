package utils.controller

import play.api.http.FileMimeTypes
import play.api.i18n.{Langs, MessagesApi}
import play.api.mvc._
import services.users.UserManagement
import utils.auth.AuthActionBuilder

class AuthControllerComponents(val authActionBuilder: AuthActionBuilder, val failureToResultMapper: FailureToResultMapper, val users: UserManagement, controllerComponents: ControllerComponents) extends ControllerComponents {
  def actionBuilder: ActionBuilder[Request, AnyContent] = controllerComponents.actionBuilder
  def parsers: PlayBodyParsers = controllerComponents.parsers
  def messagesApi: MessagesApi = controllerComponents.messagesApi
  def langs: Langs = controllerComponents.langs
  def fileMimeTypes: FileMimeTypes = controllerComponents.fileMimeTypes
  def executionContext: scala.concurrent.ExecutionContext = controllerComponents.executionContext
}