package controllers.api

import model.user.UserPermission.CanPerformAdminOperations
import play.api.libs.json.{Json, OWrites}
import services.manifest.Manifest
import services.manifest.Manifest.{Failure, ToDo, ToDoItem, ToDoResponse}
import utils.Logging
import utils.attempt.Attempt
import utils.controller.{AuthApiController, AuthControllerComponents}

class Workers(
  override val controllerComponents: AuthControllerComponents,
  manifest: Manifest,
) extends AuthApiController with Logging {

  private implicit val writesFailure: OWrites[Failure] = Json.writes[Failure]
  private implicit val writesToDoItem: OWrites[ToDoItem] = Json.writes[ToDoItem]
  private implicit val writesToDo: OWrites[ToDo] = Json.writes[ToDo]
  private implicit val writesToDoResponse: OWrites[ToDoResponse] = Json.writes[ToDoResponse]

  def getToDo() = ApiAction.attempt { req =>
    checkPermission(CanPerformAdminOperations, req) {
      Attempt.fromEither(
        manifest.getToDo().map(Json.toJson(_)).map(Ok(_))
      )
    }
  }

}
