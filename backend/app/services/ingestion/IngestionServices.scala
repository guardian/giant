package services.ingestion

import java.nio.file.{Files, Path}
import cats.syntax.either._
import extraction.{Extractor, MimeTypeMapper}
import model.{Language, Uri}
import model.ingestion.{EmailContext, FileContext, WorkspaceItemContext}
import model.manifest.{Blob, MimeType}
import services.index.{Index, IngestionData}
import services.manifest.Manifest
import services.{ObjectStorage, Tika, TypeDetector}
import utils._
import utils.attempt.AttemptAwait._
import utils.attempt.{Attempt, Failure, NotFoundFailure}

import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import services.observability.{Details, IngestionEvent, IngestionEventType, MetaData, PostgresClient, Status}

sealed trait UriParent {
  def parent: Uri
}

object UriParent {
  def createPairwiseChain(parents: List[Uri]): List[UriParent] = {
    parents.sliding(2).map {
      case child :: parent :: Nil => UriParentPair(child, parent)
      case parent :: Nil => UriJustParent(parent)
      case _ => throw new IllegalStateException("Collections::sliding(2) returned something other than a list of 1 or 2 elements.")
    }.toList
  }
}

// Parent pair is used when there are intermediate resources between the Resource we're inserting and it's parent root
private case class UriParentPair(child: Uri, parent: Uri) extends UriParent
// Just Parent is used when the inserted resources is immediately below its blob URI, e.g. an attached email under another email
private case class UriJustParent(parent: Uri) extends UriParent

/**
  * Lots of ingestion processes are useful in several places - outside of just the standard ingestion pipeline
  */
trait IngestionServices {
  def ingestEmail(context: EmailContext, sourceMimeType: String): Either[Failure, Unit]
  def ingestFile(context: FileContext, blobUri: Uri, path: Path): Either[Failure, Blob]
  def setProgressNote(blobUri: Uri, extractor: Extractor, note: String): Either[Failure, Unit]
}

object IngestionServices extends Logging {
  def apply(manifest: Manifest, index: Index, objectStorage: ObjectStorage, typeDetector: TypeDetector, mimeTypeMapper: MimeTypeMapper, dbClient: PostgresClient)(implicit ec: ExecutionContext): IngestionServices = new IngestionServices {
    override def ingestEmail(context: EmailContext, sourceMimeType: String): Either[Failure, Unit] = {

      val uriParents: List[UriParent] = UriParent.createPairwiseChain(context.parents)

      val rootUri = uriParents.last.parent

      val intermediateResources = uriParents
        .collect { case p: UriParentPair => p }
        .map(p => Manifest.InsertDirectory(parentUri = p.parent, uri = p.child))

      val insertions = intermediateResources :+ Manifest.InsertEmail(context.email, context.parents.head)

      manifest.insert(insertions, rootUri).flatMap( _ =>
        // TODO once we get attempt everywhere we can remove the await
        index.ingestEmail(context.email, context.ingestion, sourceMimeType, context.parentBlobs, context.workspace, context.languages).awaitEither(10.second)
      )
    }

    override def ingestFile(context: FileContext, blobUri: Uri, path: Path): Either[Failure, Blob] = {
      // see if the Blob already exists in the manifest to avoid doing uneeded processing
      val blob: Either[Failure, Option[Blob]] = manifest.getBlob(blobUri).map(Some(_)).recoverWith {
        // successful DB query, but the blob isn't there
        case NotFoundFailure(_) => Right[Failure, Option[Blob]](None)
      }

      val ingestionMetaData = MetaData(blobUri.value, context.ingestion)

      val upload = blob.flatMap { maybeBlob =>
        if (maybeBlob.isEmpty) {
          val result = objectStorage.create(blobUri.toStoragePath, path)
          result match {
            case Right(_) => dbClient.insertRow(IngestionEvent(ingestionMetaData, IngestionEventType.BlobCopy))
            case Left(failure: Failure) =>
              dbClient.insertRow(
                IngestionEvent(ingestionMetaData, IngestionEventType.BlobCopy, Status.Failure, Details.errorDetails(failure.msg))
              )
          }
          result
        } else {
          dbClient.insertRow(IngestionEvent(ingestionMetaData, eventType = IngestionEventType.ManifestExists))
          Right(())
        }
      }

      val uriParents: List[UriParent] = UriParent.createPairwiseChain(context.parents)

      val rootUri = uriParents.last.parent

      for {
        _ <- upload
        fileSize = Files.size(path)
        mediaType <- typeDetector.detectType(path)
        extractors = if(fileSize == 0) { List.empty } else { mimeTypeMapper.getExtractorsFor(mediaType.toString) }
        mimeType = MimeType(mediaType.toString)
        intermediateResources = uriParents.collect { case p: UriParentPair => p }.map(p => Manifest.InsertDirectory(parentUri = p.parent, uri = p.child))
        insertions = intermediateResources :+ Manifest.InsertBlob(context.file, blobUri, context.parentBlobs, mimeType, context.ingestion, context.languages.map(_.key), extractors, context.workspace)
        _ <- manifest.insert(insertions, rootUri)

        data = IngestionData(
          context.file.creationTime.map(_.toMillis),
          context.file.lastModifiedTime.map(_.toMillis),
          Set(mimeType),
          Set(context.file.uri),
          context.parentBlobs,
          context.ingestion,
          context.workspace
        )
        _ = dbClient.insertRow(
          IngestionEvent(ingestionMetaData, eventType = IngestionEventType.MimeTypeDetected, details = Details.ingestionDataDetails(data, extractors))
        )
        // TODO once we get attempt everywhere we can remove the await
        _ <- index.ingestDocument(blobUri, context.file.size, data, context.languages).awaitEither(2.minutes)
      } yield {
        Blob(blobUri, fileSize, Set(mimeType))
      }
    }

    override def setProgressNote(blobUri: Uri, extractor: Extractor, note: String): Either[Failure, Unit] = {
      manifest.setProgressNote(blobUri, extractor, note)
    }
  }


}
