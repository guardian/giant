package controllers.api

import commands.{GetResource, ResourceFetchMode}
import model.Uri
import model.frontend.email.{EmailMetadata, EmailNeighbours}
import play.api.libs.json.Json
import services.annotations.Annotations
import services.index.Index
import services.manifest.Manifest
import utils.Logging
import utils.controller.{AuthApiController, AuthControllerComponents}

object Emails {
  /* Take a list of EmailNeighbour documents (from the manifest) and enrich with metadata (from the index) */
  private def attachMetadata(thread: List[EmailNeighbours], metadata: Map[String, EmailMetadata]): List[EmailNeighbours] = {
    thread.map { original =>
      original.copy(email = original.email.copy(metadata = metadata.get(original.email.uri)))
    }
  }

  /*
    Sort a list of EmailNeighbour objects, some of which have timestamps and some of which do not. The sort is done such
    that a EmailNeighbour object may not be later in the list than any other object that references it.
    This is done in two phases:
     - Firstly we filter and sort all objects that have an actual timestamp
     - Secondly we insert the remaining objects one at a time just before the first reference to that object
   */
  private[api] def sort(thread: List[EmailNeighbours]): List[EmailNeighbours] = {
    val knownTimestamp = thread.filter(_.email.metadata.flatMap(_.sentAt).isDefined).sortBy(_.email.metadata.flatMap(_.sentAt.map(_.time)))
    val ghosts = thread.filter(_.email.metadata.flatMap(_.sentAt).isEmpty).sortBy(_.email.uri)
    ghosts.foldLeft(knownTimestamp){case (acc, ghost) =>
      def referenceToGhost: EmailNeighbours => Boolean = _.neighbours.exists(_.uri == ghost.email.uri)
      // insert ghost just before first reference to it
      val before = acc.takeWhile(!referenceToGhost(_))
      val after = acc.dropWhile(!referenceToGhost(_))
      before ::: ghost :: after
    }
  }

  /*
    Find any nodes that are referenced but missing. If this is non-empty then it is indicative that the graph search was
    too limited in scope and we are missing data that is available in the graph database but was not returned in our
    results.
   */
  private[api] def missingNodes(thread: List[EmailNeighbours]): Set[String] = {
    val allUris = thread.flatMap(_.uris).distinct
    val missingNodes: Set[String] = allUris.toSet -- thread.map(_.email.uri).toSet
    missingNodes
  }
}

class Emails(val controllerComponents: AuthControllerComponents, manifest: Manifest, index: Index, annotations: Annotations)
  extends AuthApiController with Logging {

  def getThread(uri: Uri) = ApiAction.attempt { req =>
    for {
      // Check we at least have permission to see the requested root of the thread
      // TODO MRB: fully restrict the thread based on what the user can see?
      _ <- GetResource(uri, ResourceFetchMode.Basic, req.user.username, manifest, index, annotations, controllerComponents.users).process()
      rawThread <- manifest.getEmailThread(uri.value)
      uris = rawThread.flatMap(_.uris).distinct
      metadata <- index.getEmailMetadata(uris)
      unsortedThread = Emails.attachMetadata(rawThread, metadata)
      thread = Emails.sort(unsortedThread)
    } yield {
      Ok(
        Json.obj(
          "thread" -> Json.toJson(thread),
          "missingNodes" -> Emails.missingNodes(rawThread).toList
        )
      )
    }
  }
}
