package controllers.api

import model.Uri
import model.user.UserPermission.CanPerformAdminOperations
import play.api.libs.json.Json
import play.api.mvc.{Action, AnyContent}
import services.observability.{BlobStatus, PostgresClient}
import services.users.UserManagement
import utils.attempt._
import utils.controller.{AuthApiController, AuthControllerComponents}

class IngestionEvents(override val controllerComponents: AuthControllerComponents, postgresClient: PostgresClient,
                      users: UserManagement)
  extends AuthApiController {

  private def getEvents(collection: String, ingestion: Option[String] = None): Action[AnyContent] = ApiAction.attempt { req =>
    (for {
      canSeeCollection <- users.canSeeCollection(req.user.username, Uri(collection))
      isAdmin <- users.hasPermission(req.user.username, CanPerformAdminOperations)
    } yield {
      (isAdmin, canSeeCollection)
    }).flatMap {
      case (isAdmin, canSeeCollection) if isAdmin || canSeeCollection =>
        val ingestIdSuffix = ingestion.map(i => s"/$i").getOrElse("")
        val ingestId = s"$collection$ingestIdSuffix"
        val maybeEvents = postgresClient.getEvents(ingestId, ingestion.isEmpty)
        val anonymisedEvents = if (canSeeCollection) {
          // return original data
          maybeEvents
        } else {
          // admins may need to see historical data for e.g. gaining an understanding of the most common types of error
          // but they don't need to connect it to a particular user
          maybeEvents.map(e => BlobStatus.anonymiseEventsOlderThanTwoWeeks(e))
        }
        Attempt.fromEither(anonymisedEvents.map(e => Ok(Json.toJson(e))))
      case _ =>
        // GitHub-style error - a thing exists but we can't see it so tell the user it doesn't exist
        Attempt.Left(NotFoundFailure(s"$collection/${ingestion.getOrElse("")} does not exist"))
      }
  }

  def getCollectionEvents(collection: String) = getEvents(collection, None)
  def getIngestionEvents(collection: String, ingestion: String) = getEvents(collection, Some(ingestion))

}
