package controllers.api

import model.Uri
import model.user.UserPermission.CanPerformAdminOperations
import play.api.libs.json.Json
import play.api.mvc.{Action, AnyContent}
import services.observability.PostgresClient
import services.users.UserManagement
import utils.attempt._
import utils.controller.{AuthApiController, AuthControllerComponents}

class IngestionEvents(override val controllerComponents: AuthControllerComponents, postgresClient: PostgresClient,
                      users: UserManagement)
  extends AuthApiController {

//  private def getEvents(collection: String, ingestion: Option[String] = None) = {
//        val ingestIdSuffix = ingestion.map(i => s"/$i").getOrElse("")
//        val ingestId = s"$collection$ingestIdSuffix"
//        Attempt.fromEither(postgresClient.getEvents(ingestId, ingestion.isEmpty).map(e => Ok(Json.toJson(e))))
//  }

  def getEvents(collection: String, ingestion: Option[String] = None): Action[AnyContent] = ApiAction.attempt { req =>
    users.canSeeCollection(req.user.username, Uri(collection)).flatMap {
      case true =>
        val ingestIdSuffix = ingestion.map(i => s"/$i").getOrElse("")
        val ingestId = s"$collection$ingestIdSuffix"
        Attempt.fromEither(postgresClient.getEvents(ingestId, ingestion.isEmpty).map(e => Ok(Json.toJson(e))))
      case false =>
        // GitHub-style error - a thing exists but we can't see it so tell the user it doesn't exist
        Attempt.Left(NotFoundFailure(s"$collection/$ingestion does not exist"))
    }
  }

  def getCollectionEvents(collection: String) = getEvents(collection, None)
  def getIngestionEvents(collection: String, ingestion: String) = getEvents(collection, Some(ingestion))

}
