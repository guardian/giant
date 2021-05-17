package commands

import model.frontend.{Filter, FilterNames, FilterOption}
import model.index.Flags
import services.annotations.Annotations
import services.manifest.Manifest
import services.users.UserManagement
import utils.MimeDetails
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

case class GetFilters(manifest: Manifest, userManagement: UserManagement, annotations: Annotations, username: String)(implicit executionContext: ExecutionContext) extends AttemptCommand[List[Filter]] {
  def process(): Attempt[List[Filter]] = {
    for {
      allCollections <- manifest.getCollections
      visibleCollections <- userManagement.getVisibleCollectionUrisForUser(username)
      collections = allCollections.filter { c => visibleCollections.contains(c.uri.value) }

      workspaces <- annotations.getAllWorkspacesMetadata(username)
      mimeTypes <- manifest.getAllMimeTypes
    } yield {
      List (
        Filter(FilterNames.workspaces.key, FilterNames.workspaces.display, hideable = false,
          workspaces.map { workspace =>
            FilterOption(
              workspace.id,
              workspace.name
            )
          }
        ),
        Filter(FilterNames.collections.key, FilterNames.collections.display, hideable = false,
          collections.map { c =>
            FilterOption(
              c.uri.value,
              c.display,
              None,
              Some(c.ingestions.map(i => FilterOption(i.uri, i.display)))
            )
          }
        ),
        Filter(FilterNames.mimeTypes.key, FilterNames.mimeTypes.display, hideable = false,
          mimeTypes
            .map(m => {
              val mediaType = m.mimeType.split("/").head
              FilterOption(
                mediaType + "/",
                mediaType.capitalize,
                None,
                Some(mimeTypes
                  .filter(_.mimeType.startsWith(mediaType))
                  .map(subtype => {
                    val subtypeDetails = MimeDetails.get(subtype.mimeType).getOrElse(MimeDetails(subtype.mimeType))
                    FilterOption(subtype.mimeType, subtypeDetails.display, subtypeDetails.explanation)
                  })
                )
              )
            }
          ).distinct
        )
      )
    }
  }
}

