package commands

import java.nio.file.Paths

import model.{CreateIngestionRequest, Language, Languages, Uri}
import services.index.{Index, Pages}
import services.manifest.Manifest
import utils.{Logging, UriCleaner}
import utils.attempt._

import scala.concurrent.ExecutionContext

case class CreateIngestion(data: CreateIngestionRequest, collectionUri: Uri, manifest: Manifest, index: Index, pages: Pages)
                          (implicit ec: ExecutionContext) extends AttemptCommand[Uri] with Logging {
  def process(): Attempt[Uri] = {

    val providedDisplayName = data.name.toAttempt {
      manifest.getIngestionCount(collectionUri).map { i =>
        s"Ingestion ${(i + 1).toString}"
      }
    }

    val langs = data.languages.flatMap(Languages.getByKey)

    for {
      display <- providedDisplayName
      id = UriCleaner.clean(display)
      ingestionUri = collectionUri.chain(id)
      rootPath = data.path.map(Paths.get(_))
      languages <- if (langs.nonEmpty) Attempt.Right(langs) else Attempt.Left(ClientFailure("No valid languages specified"))
      uri <- manifest.insertIngestion(collectionUri, ingestionUri, id, rootPath, languages, data.fixed.getOrElse(true), data.default.getOrElse(false))
    } yield uri
  }
}
