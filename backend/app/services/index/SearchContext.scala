package services.index

import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.requests.searches.queries.{BoolQuery, Query}
import model.annotations.{WorkspaceEntry, WorkspaceLeaf}
import model.frontend.{TreeEntry, TreeLeaf, TreeNode}
import model.index.SearchParameters
import services.annotations.Annotations
import services.users.UserManagement
import utils.attempt.{Attempt, ClientFailure, NotFoundFailure}

import scala.concurrent.ExecutionContext

sealed trait SearchContext
case class DefaultSearchContext(visibleCollections: Set[String], visibleWorkspaces: List[String]) extends SearchContext
case class WorkspaceFolderSearchContext(blobUris: List[String]) extends SearchContext

case class WorkspaceSearchContextParams(workspaceId: String, workspaceFolderId: String)

object SearchContext {
  def build(username: String, users: UserManagement, annotations: Annotations)(implicit ec: ExecutionContext): Attempt[DefaultSearchContext] = for {
    visibleCollections <- users.getVisibleCollectionUrisForUser(username)
    visibleWorkspaces <- annotations.getAllWorkspacesMetadata(username)
  } yield {
    DefaultSearchContext(visibleCollections, visibleWorkspaces.map(_.id))
  }

  def buildBlobFiltersForWorkspaceFolder(username: String, workspaceId: String, workspaceFolderId: String, annotations: Annotations)(implicit ec: ExecutionContext): Attempt[List[String]] = {
    annotations.getWorkspaceContents(username, workspaceId).flatMap { root =>
      TreeEntry.findNodeById(root, workspaceFolderId) match {
        case Some(_: TreeLeaf[WorkspaceEntry]) =>
          Attempt.Left(ClientFailure(s"$workspaceFolderId is a leaf, not a node in workspace $workspaceId"))

        case None =>
          Attempt.Left(NotFoundFailure(s"$workspaceFolderId not found in workspace $workspaceId"))

        case Some(node: TreeNode[WorkspaceEntry]) =>
          Attempt.Right(findBlobsInWorkspaceFolder(node))
      }
    }
  }

  def buildFilters(parameters: SearchParameters, context: SearchContext): BoolQuery = {
    val createdAtFilter = buildCreatedAtFilter(parameters.start, parameters.end)
    val mimeFilter = buildMimeFilter(parameters)

    val visibilityFilters = context match {
      case context: DefaultSearchContext => buildIngestionAndWorkspaceFilters(parameters, context)
      case WorkspaceFolderSearchContext(blobUris) => buildWorkspaceBlobFilter(blobUris).toList
    }

    must(
      createdAtFilter ++
      visibilityFilters ++
      mimeFilter
    )
  }

  def findBlobsInWorkspaceFolder(folder: TreeEntry[WorkspaceEntry]): List[String] = {
    folder match {
      case leaf: TreeLeaf[WorkspaceEntry] => leaf.data match {
        case node: WorkspaceLeaf => List(node.uri)
        case _ => throw new IllegalStateException(s"Unexpected WorkspaceNode wrapped by TreeLeaf ${leaf.id}")
      }

      case node: TreeNode[WorkspaceEntry] => node.children.foldLeft(List.empty[String]) { (acc, entry) =>
        acc ++ findBlobsInWorkspaceFolder(entry)
      }
    }
  }

  private def buildWorkspaceFilter(workspaceId: String) = {
    nestedQuery(IndexFields.workspacesField,
      termQuery(s"${IndexFields.workspacesField}.${IndexFields.workspaces.workspaceId}", workspaceId)
    )
  }

  // At this point parameters have already been checked for permissions so we only require filters if the user has
  // not already refined their search further
  private def buildIngestionAndWorkspaceFilters(parameters: SearchParameters, context: DefaultSearchContext) = {
    val cannotSeeAnything = context.visibleCollections.isEmpty && context.visibleWorkspaces.isEmpty
    val noFiltersSpecified = parameters.ingestionFilters.isEmpty && parameters.workspaceFilters.isEmpty

    if(cannotSeeAnything) {
      // This is a fail-safe, we should have checked permissions and returned an empty result set in the controller
      throw new IllegalStateException("No visible collections or workspaces")
    }

    if(noFiltersSpecified) {
      // Show the user results in any collection or workspace they can see. Example translated into boolean logic:
      //   (collection == 'Panama' OR collection == 'Paradise') OR (workspace == 'Shared With Barry')
      List(
        should(
          context.visibleCollections.map { c => prefixQuery(IndexFields.ingestionRaw, c + '/') } ++
          context.visibleWorkspaces.map(buildWorkspaceFilter)
        )
      )
    } else {
      // Show the user just what they asked for. Example again (NB the 'AND' is performed by the `must` in the calling code)
      //   (collection == 'Panama' OR collection == 'Paradise') AND (workspace == 'Shared With Barry')
      List(
        should(parameters.ingestionFilters.map(prefixQuery(IndexFields.ingestionRaw, _))),
        should(parameters.workspaceFilters.map(buildWorkspaceFilter))
      )
    }
  }

  private def buildMimeFilter(parameters: SearchParameters) = {
    List(
      should(parameters.mimeFilters.map(mime => prefixQuery("metadata." + IndexFields.metadata.mimeTypesRaw, mime)))
    )
  }

  private def buildCreatedAtFilter(maybeStart: Option[Long], maybeEnd: Option[Long]): Option[Query] = {
    (maybeStart, maybeEnd) match {
      case (Some(start), Some(end)) =>
        Some(rangeQuery(IndexFields.createdAt).gte(start).lt(end))

      case (Some(start), None) =>
        Some(rangeQuery(IndexFields.createdAt).gte(start))

      case (None, Some(end)) =>
        Some(rangeQuery(IndexFields.createdAt).lt(end))

      case _ =>
        None
    }
  }
  
  private def buildWorkspaceBlobFilter(blobUris: List[String]): Option[BoolQuery] = {
    if(blobUris.isEmpty) {
      None
    } else {
      // The blob URIs have come from expanding a workspace folder into the blobs below it.
      // We want to search and return results from all blobs, not just results that are present only in all of them.
      // So we combine with OR (should) rather than must (AND).
      Some(should(
        blobUris.flatMap { blobUri =>
          List(
            termQuery("_id", blobUri),
            // Also recursively match anything that is a child of this blob. They don't appear in the workspace tree but
            // people should be able to access them even if they don't have access to the underlying dataset.
            termQuery(IndexFields.parentBlobs, blobUri)
          )
        }
      ))
    }
  }
}
