package commands

import com.google.common.net.PercentEscaper
import model.Uri
import model.frontend.{BasicResource, DocumentResource, EmailResource, Resource}
import services.annotations.Annotations
import services.index.Index
import services.manifest.Manifest
import services.users.UserManagement
import utils.attempt.{Attempt, ContentTooLongFailure, NotFoundFailure}

import scala.concurrent.ExecutionContext

sealed trait ResourceFetchMode

object ResourceFetchMode {
  case object Basic extends ResourceFetchMode
  case class WithData(query: Option[String]) extends ResourceFetchMode
}

case class GetResource(uri: Uri, mode: ResourceFetchMode, username: String, manifest: Manifest, index: Index, annotations: Annotations, users: UserManagement)(implicit ec: ExecutionContext) extends AttemptCommand[Resource] {
  override def process(): Attempt[Resource] = for {
    visibleCollections <- users.getVisibleCollectionUrisForUser(username)
    basicResource <- manifest.getResource(uri).toAttempt.flatMap(validatePermissions(_, visibleCollections))
    fullResource <- mergeResourcesIfRequired(basicResource)
    topLevelParent <- fetchTopLevelParent(fullResource)
  } yield {
    GetResource.formatResourceForClient(fullResource, topLevelParent)
  }

  private def validatePermissions(resource: BasicResource, visibleCollections: Set[String]): Attempt[BasicResource] = {
    val urisOfResourceAndParents = (resource.uri :: resource.parents.map(_.uri)).toSet
    val rootUrisOfResourceAndParents = urisOfResourceAndParents.map(Uri(_).root)

    if (visibleCollections.intersect(rootUrisOfResourceAndParents).nonEmpty) {
      Attempt.Right(resource)
    } else {
      annotations.getAllWorkspacesMetadata(username).flatMap { visibleWorkspaces =>
        index.anyWorkspaceOrCollectionContainsAnyResource(
          collectionUris = visibleCollections,
          workspaceIds = visibleWorkspaces.map(_.id).toSet,
          resourceUris = rootUrisOfResourceAndParents
        ) flatMap {
          case true => Attempt.Right(resource)
          case false => Attempt.Left(NotFoundFailure(s"${resource.uri} does not exist"))
        }
      }
    }
  }

  private def mergeResourcesIfRequired(resource: BasicResource): Attempt[Resource] = mode match {
    case ResourceFetchMode.Basic =>
      Attempt.Right(resource)

    case ResourceFetchMode.WithData(query) =>
      index.getPageCount(uri).flatMap {
        // From testing we know that page counts over 500 start to run into
        // rendering difficulties in the browser.
        case Some(pageCount) if pageCount > 500 => Attempt.Right(resource)
        case _ => (for {
          indexed <- index.getResource(uri, query)
          comments <- annotations.getComments(uri)
        } yield {
          Resource.mergeResources(indexed, resource, comments)
        }).recoverWith {
          case _: ContentTooLongFailure =>
            // fall back to a basic response
            Attempt.Right(resource)
        }
      }
  }

  // This is to show the name of a blob at the top of the breadcrumb trail when browsing within a zip file.
  // The user may be able to see multiple top-level parents (for example the same ZIP file in different places in
  // the same ingestion) in which case we pick the first one they can see as a compromise.
  private def fetchTopLevelParent(resource: Resource): Attempt[Option[String]] = {
    resource.parents.headOption.flatMap(_.uri.split('/').headOption) match {
      case Some(parent) =>
        Attempt.fromEither(manifest.getResource(Uri(parent))).map { topLevelParent =>
          if(topLevelParent.`type` == "blob" && topLevelParent.parents.nonEmpty) {
            Some(topLevelParent.parents.head.uri.split('/').last)
          } else {
            Some(parent)
          }
        }

      case None =>
        Attempt.Right(None)
    }
  }
}

object GetResource {
  // Java URLEncoder encodes spaces as + and not %20 which is what we need on the client side so we use the
  // Guava urlFragmentEscaper instead. We customise it slightly to force encoding of question marks
  val escaper = new PercentEscaper("-._~!$'()*,;&=@:+/", false)

  def formatResourceForClient(resource: Resource, topLevelParent: Option[String]): Resource = resource match {
    case basic: BasicResource =>
      basic.copy(
        uri = escaper.escape(basic.uri),
        display = basic.display.orElse(Some(formatResourceUriForClient(resource.uri, topLevelParent))),
        children = basic.children.map(child => child.copy(
          uri = escaper.escape(child.uri),
          display = child.display.orElse(Some(formatResourceUriForClient(child.uri, topLevelParent)))
        )),
        parents = basic.parents.map(parent => parent.copy(
          uri = escaper.escape(parent.uri),
          display = parent.display.orElse(Some(formatResourceUriForClient(parent.uri, topLevelParent)))
        ))
      )

    case doc: DocumentResource =>
      doc.copy(
        uri = escaper.escape(doc.uri),
        display = doc.display.orElse(Some(formatResourceUriForClient(resource.uri, topLevelParent))),
        children = doc.children.map(child => child.copy(
          uri = escaper.escape(child.uri),
          display = child.display.orElse(Some(formatResourceUriForClient(child.uri, topLevelParent)))
        )),
        parents = doc.parents.map(parent => parent.copy(
          uri = escaper.escape(parent.uri),
          display = parent.display.orElse(Some(formatResourceUriForClient(parent.uri, topLevelParent)))
        ))
      )

    case email: EmailResource =>
      email.copy(
        uri = escaper.escape(email.uri),
        display = email.display.orElse(Some(formatResourceUriForClient(resource.uri, topLevelParent))),
        children = email.children.map(child => child.copy(
          uri = escaper.escape(child.uri),
          display = child.display.orElse(Some(formatResourceUriForClient(child.uri, topLevelParent)))
        )),
        parents = email.parents.map(parent => parent.copy(
          uri = escaper.escape(parent.uri),
          display = parent.display.orElse(Some(formatResourceUriForClient(parent.uri, topLevelParent)))
        ))
      )
  }

  def formatResourceUriForClient(uri: String, topLevelParent: Option[String]): String = {
    topLevelParent match {
      case Some(parent) if uri.startsWith(parent) =>
        uri

      case Some(parent) =>
        (parent +: uri.split('/').drop(1)).mkString("/")

      case None =>
        uri
    }
  }

}
