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
    val (ingestionId, ingestionUri) = provideIngestionUri()

    createIngestion(ingestionId, ingestionUri)
  }

  def createOrGet(): Attempt[Uri] = {
    val (ingestionId, ingestionUri) = provideIngestionUri()
    val current = ingestionUri.flatMap(uri => manifest.getIngestion(uri))

    current.map { c =>
      println(s"ingestion ${c.uri} already exists")
      Uri(c.uri)
    }.recoverWith {
      case f: NotFoundFailure =>
        println(s"error getting ingestion - ${f.msg}")
        createIngestion(ingestionId, ingestionUri)
    }
  }

  private def provideIngestionUri(): (Attempt[String], Attempt[Uri]) = {
    val providedDisplayName = getProvidedDisplayName()

    val ingestionId = providedDisplayName.map(d => UriCleaner.clean(d))
    val ingestionUri = ingestionId.map(id => collectionUri.chain(id))
    (ingestionId, ingestionUri)
  }

  private def createIngestion(ingestionId: Attempt[String], ingestionUri: Attempt[Uri]): Attempt[Uri] = {
    val langs = data.languages.flatMap(Languages.getByKey)
    for {
      id <- ingestionId
      uri <- ingestionUri
      rootPath = data.path.map(Paths.get(_))
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
