package controllers.api

import java.time.{LocalDateTime, ZoneOffset}

import model.annotations.{WorkspaceEntry, WorkspaceLeaf}
import model.frontend._
import model.index._
import play.api.libs.json._
import play.api.mvc.RequestHeader
import services.annotations.Annotations
import services.index._
import services.users.UserManagement
import utils.Logging
import utils.attempt.{Attempt, ClientFailure, NotFoundFailure}
import utils.auth.{User, UserIdentityRequest}
import utils.controller.{AuthApiController, AuthControllerComponents}
import services.{MetricsService}

import scala.concurrent.ExecutionContext

class Search(override val controllerComponents: AuthControllerComponents, userManagement: UserManagement,
             index: Index, annotations: Annotations, metricsService: MetricsService) extends AuthApiController with Logging {

  def search() = ApiAction.attempt { req: UserIdentityRequest[_] =>
    val q = req.queryString.getOrElse("q", Seq("")).head
    val proposedParams = Search.buildSearchParameters(q, req)
    proposedParams.workspaceContext.map(wc => {
      logger.info(req.user.asLogMarker, "Performing workspace search")
      metricsService.recordSearchInFolderEvent(req.user.username)
    })

    buildSearch(req.user, proposedParams, proposedParams.workspaceContext).flatMap { case (verifiedParams, context) =>
      val returnEmptyResult = Search.shouldReturnEmptyResult(proposedParams, verifiedParams, context)

      if(returnEmptyResult) {
        Attempt.Right(Ok(Json.toJson(SearchResults.empty)))
      } else {
        index.query(verifiedParams, context).map { searchResults =>
          Ok(Json.toJson(searchResults))
        }
      }
    }
  }

  def chips() = ApiAction {
    Right(
      Ok(
        Json.toJson(
          Chips.all
        )
      )
    )
  }

  private def buildSearch(user: User, proposedParams: SearchParameters, workspaceSearchParams: Option[WorkspaceSearchContextParams]): Attempt[(SearchParameters, SearchContext)] = {
    workspaceSearchParams match {
      case Some(WorkspaceSearchContextParams(workspaceId, workspaceFolderId)) =>
        annotations.getAllWorkspacesMetadata(user.username).flatMap { workspaces =>
          if(workspaces.exists(_.id == workspaceId)) {
            for {
              blobFilters <- SearchContext.buildBlobFiltersForWorkspaceFolder(user.username, workspaceId, workspaceFolderId, annotations)
            } yield {
              proposedParams -> WorkspaceFolderSearchContext(blobFilters)
            }
          } else {
            buildDefaultSearch(user, proposedParams)
          }
        }

      case None =>
        buildDefaultSearch(user, proposedParams)
    }
  }

  private def buildDefaultSearch(user: User, proposedParams: SearchParameters): Attempt[(SearchParameters, SearchContext)] = {
    for {
      context <- SearchContext.build(user.username, userManagement, annotations)
      verifiedParams = Search.verifyParameters(user, proposedParams, context)
    } yield {
      verifiedParams -> context
    }
  }
}

object Search extends Logging {
  def buildSearchParameters(q: String, req: RequestHeader)(implicit ec: ExecutionContext): SearchParameters = {
    val page = req.queryString.getOrElse("page", Seq("1")).head.toInt
    val pageSize = req.queryString.getOrElse("pageSize", Seq("20")).head.toInt
    val sortBy = req.queryString.getOrElse("sortBy", Seq("relevance")).head match {
      case "relevance" => Relevance
      case "size-asc" => SizeAsc
      case "size-desc" => SizeDesc
      case "date-created-asc" => CreatedAtAsc
      case "date-created-desc" => CreatedAtDesc
    }
    val mimeFilters = req.queryString.getOrElse("mimeType[]", Seq()).toList
    val ingestionFilters = req.queryString.getOrElse("ingestion[]", Seq()).toList
    val workspaceFilters = req.queryString.getOrElse("workspace[]", Seq()).toList

    val createdAtFilters = req.queryString.getOrElse("createdAt[]", Seq()).toList
    val (start, end) = parseCreatedAt(createdAtFilters)

    val parsedChips = Chips.parseQueryString(q)

    SearchParameters(parsedChips.query, mimeFilters, ingestionFilters, workspaceFilters, start, end, page, pageSize, sortBy, parsedChips.workspace)
  }

  def verifyParameters(user: User, params: SearchParameters, context: DefaultSearchContext): SearchParameters = {
    val ingestionFilters = params.ingestionFilters.flatMap (verifyIngestionFilter (user, _, context.visibleCollections) )
    val workspaceFilters = params.workspaceFilters.flatMap (verifyWorkspaceFilter (user, _, context.visibleWorkspaces) )

    params.copy (
      ingestionFilters = ingestionFilters,
      workspaceFilters = workspaceFilters
    )
  }

  def shouldReturnEmptyResult(proposedParams: SearchParameters, verifiedParams: SearchParameters, context: SearchContext): Boolean = {
    context match {
      case WorkspaceFolderSearchContext(blobUris) =>
        blobUris.isEmpty

      case DefaultSearchContext(visibleCollections, visibleWorkspaces) =>
        val cannotSeeAnyWorkspacesRequestedAndHasNoIngestionFilters =
          proposedParams.workspaceFilters.nonEmpty &&
            verifiedParams.workspaceFilters.isEmpty &&
            verifiedParams.ingestionFilters.isEmpty

        val cannotSeeAnyCollectionsRequestedAndHasNoWorkspaceFilters =
          proposedParams.ingestionFilters.nonEmpty &&
            verifiedParams.ingestionFilters.isEmpty &&
            verifiedParams.workspaceFilters.isEmpty

        val cannotSeeAnythingAtAll =
          visibleWorkspaces.isEmpty &&
          visibleCollections.isEmpty

        cannotSeeAnyWorkspacesRequestedAndHasNoIngestionFilters ||
          cannotSeeAnyCollectionsRequestedAndHasNoWorkspaceFilters ||
          cannotSeeAnythingAtAll
    }
  }

  // Filtering by both collection and ingestion is done using a prefix query on the `ingestion` field
  private def verifyIngestionFilter(user: User, filter: String, visibleCollections: Set[String]): Option[String] = {
    filter.split("/").toList match {
      case collection :: Nil if visibleCollections.contains(collection) =>
        Some(s"${collection}/")

      case collection :: ingestion :: Nil if visibleCollections.contains(collection) =>
        Some(s"${collection}/${ingestion}")

      case _ =>
        logger.warn(user.asLogMarker, s"User ${user.username} requested ingestion $filter but can only see [${visibleCollections.mkString(",")}]")
        None
    }
  }

  private def verifyWorkspaceFilter(user: User, filter: String, visibleWorkspaces: List[String]): Option[String] = {
    if(visibleWorkspaces.contains(filter)) {
      Some(filter)
    } else {
      logger.warn(user.asLogMarker, s"User ${user.username} requested workspace $filter but can only see [${visibleWorkspaces.mkString(",")}]")
      None
    }
  }

  private def parseCreatedAt(filters: List[String]): (Option[Long], Option[Long]) = {
    filters.map { filter => filter.split("/").toList } match {
      case (year :: month :: Nil) :: Nil =>
        val yearStart = LocalDateTime.of(year.toInt, month.toInt, 1, 0, 0)
        val monthEnd = yearStart.plusMonths(1)

        (Some(epochTs(yearStart)), Some(epochTs(monthEnd)))

      case (year :: Nil) :: Nil =>
        val yearStart = LocalDateTime.of(year.toInt, 1, 1, 0, 0)
        val yearEnd = yearStart.plusMonths(12)

        (Some(epochTs(yearStart)), Some(epochTs(yearEnd)))

      case Nil =>
        (None, None)

      case _ =>
        throw new IllegalArgumentException(s"Unknown format for createdAt[] filter: ${filters.mkString(",")}")
    }
  }

  private def epochTs(instant: LocalDateTime): Long = {
    instant.toInstant(ZoneOffset.UTC).toEpochMilli
  }
}
