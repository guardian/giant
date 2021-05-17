package controllers.api

import model.user.UserPermission.CanPerformAdminOperations
import play.api.libs.json._
import services.events.{Event, EventFilter, TagEquals, TagNotEquals, Events => EventsService}
import utils.attempt.Attempt
import utils.controller.{AuthApiController, AuthControllerComponents}

class Events(override val controllerComponents: AuthControllerComponents, esEvents: EventsService)
  extends AuthApiController {

  def listAllUploads(showAdminUploads: Option[Boolean]) = ApiAction.attempt { request =>
    checkPermission(CanPerformAdminOperations, request) {
      fetchAllUploadEvents(showAdminUploads.getOrElse(false)).map { events =>
        Ok(Json.obj("events" -> events))
      }
    }
  }

  private def fetchAllUploadEvents(showAdminUploads: Boolean): Attempt[List[Event]] = {
    val maybeAdminFilters = if(showAdminUploads) {
      Attempt.Right(List.empty[EventFilter])
    } else {
      controllerComponents.users.listUsersWithPermission(CanPerformAdminOperations).map { users =>
        users.map { user => TagNotEquals("username", user.username) }
      }
    }

    maybeAdminFilters.flatMap { adminFilters =>
      esEvents.find(
        filters = List(TagEquals("type", "upload")) ++ adminFilters,
        pageSize = 1000
      )
    }.map(_.results)
  }
}
