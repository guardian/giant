package commands

import model.Uri
import model.manifest.Collection
import services.manifest.Manifest
import utils.UriCleaner
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

case class CreateCollection(name: String, username: String, manifest: Manifest)
                           (implicit ec: ExecutionContext) extends AttemptCommand[Collection] {
  def process(): Attempt[Collection] = {
    val id = UriCleaner.clean(name)

    manifest.getCollection(Uri(id)).transform(
      collection =>
        Attempt.Right(collection),
      _ =>
        manifest.insertCollection(id, name, username)
    )
  }
}

