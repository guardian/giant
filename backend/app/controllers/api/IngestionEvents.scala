package controllers.api

import model.Uri
import play.api.libs.json.Json
import play.api.mvc.{Action, AnyContent}
import services.observability.PostgresClient
import services.users.UserManagement
import utils.attempt._
import utils.controller.{AuthApiController, AuthControllerComponents}


class IngestionEvents(override val controllerComponents: AuthControllerComponents, postgresClient: PostgresClient,
                      users: UserManagement)
  extends AuthApiController {


  def getEvents(collection: String, ingestion: String): Action[AnyContent] = ApiAction.attempt { req =>
    users.canSeeCollection(req.user.username, Uri(collection)).flatMap {



      case true =>
        println(Uri(collection).chain(ingestion).value)
        Attempt.fromEither(postgresClient.getEvents(Uri(collection).chain(ingestion).value).map(e => Ok(Json.toJson(e))))
      case false =>
        // GitHub-style error - a thing exists but we can't see it so tell the user it doesn't exist
        Attempt.Left(NotFoundFailure(s"$collection does not exist"))
    }
  }

}
