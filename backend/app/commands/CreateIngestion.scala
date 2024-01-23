package commands

import java.nio.file.Paths

import model.{CreateIngestionRequest, Languages, Uri}
import services.index.{Index, Pages}
import services.manifest.Manifest
import utils.{Logging, UriCleaner}
import utils.attempt._

import scala.concurrent.ExecutionContext

case class CreateIngestion(data: CreateIngestionRequest, collectionUri: Uri, manifest: Manifest, index: Index, pages: Pages)
                          (implicit ec: ExecutionContext) extends AttemptCommand[Uri] with Logging {
  def process(): Attempt[Uri] = {
    val idUri = provideIngestionUri()

    idUri.flatMap{ case (ingestionId, ingestionUri) =>
      createIngestion(ingestionId, ingestionUri)
    }
  }

  def createOrGet(): Attempt[Uri] = {
    val ingestionTuple = provideIngestionUri()
    val current = ingestionTuple.flatMap(idUri => manifest.getIngestion(idUri._2))

    current.map { c =>
      Uri(c.uri)
    }.recoverWith {
      case f: NotFoundFailure =>
        ingestionTuple.flatMap{case (id, uri) => createIngestion(id, uri)}
    }
  }

  private def provideIngestionUri(): Attempt[(String, Uri)] = {
    val providedDisplayName = getProvidedDisplayName()

    providedDisplayName.map{ name =>
      val id = UriCleaner.clean(name)
      val uri = collectionUri.chain(id)
      (id, uri)
    }
  }

  private def createIngestion(id: String, uri: Uri): Attempt[Uri] = {
    val langs = data.languages.flatMap(Languages.getByKey)
    val rootPath = data.path.map(Paths.get(_))
    for {
      languages <- if (langs.nonEmpty) Attempt.Right(langs) else Attempt.Left(ClientFailure("No valid languages specified"))
      uri <- manifest.insertIngestion(collectionUri, uri, id, rootPath, languages, data.fixed.getOrElse(true), data.default.getOrElse(false))
    } yield uri
  }

  private def getProvidedDisplayName(): Attempt[String] = {
    data.name.toAttempt {
      manifest.getIngestionCount(collectionUri).map { i =>
        s"Ingestion ${(i + 1).toString}"
      }
    }
  }
}
