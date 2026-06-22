package services.ingestion

import java.nio.file.{Files, Path}
import cats.syntax.either._
import extraction.{ExternalTranslationExtractor, ExtractionParams, Extractor, MimeTypeMapper}
import model.{Language, Uri}
import model.ingestion.{EmailContext, FileContext, WorkspaceItemContext}
import model.manifest.{Blob, MimeType}
import org.apache.tika.language.detect.LanguageDetector
import services.index.{Index, IngestionData}
import services.manifest.Manifest
import services.{ObjectStorage, Tika, TypeDetector}
import utils._
import utils.attempt.AttemptAwait._
import utils.attempt.{Attempt, Failure, NotFoundFailure}

import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import services.observability.{BlobMetadata, EventDetails, EventMetadata, EventStatus, IngestionEvent, IngestionEventType, PostgresClient}

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

  def recordIngestionEvent(event: IngestionEvent): Unit
  def ingestEmail(context: EmailContext, sourceMimeType: String): Either[Failure, Unit]
  def ingestFile(context: FileContext, blobUri: Uri, path: Path, isFastLane: Boolean = false): Either[Failure, Blob]
  def setProgressNote(blobUri: Uri, extractor: Extractor, note: String): Either[Failure, Unit]
  def detectLanguage(blobUri: String, text: String): Option[String]
  def addTranslationTodo(blobUri: Uri, params: ExtractionParams): Either[Failure, Unit]
}

object IngestionServices extends Logging {

  private def cleanTextForLanguageDetection(text: String): String = {
    text
      .replaceAll("""https?://\S+""", "")                // removes URLs starting with http:// or https:// followed by non-whitespace
      .replaceAll("""www\.\S+""", "")                     // removes URLs starting with www. that have no scheme
      .replaceAll("""[\w.+-]+@[\w.-]+\.\w+""", "")        // removes email addresses (e.g. user.name+tag@domain.co.uk)
      .replaceAll("""[A-Za-z]:\\[\\\w.\-]+""", "")        // removes Windows file paths (e.g. C:\Users\file.txt)
      .replaceAll("""/[\w./\-]+""", "")                   // removes Unix file paths starting with / (e.g. /usr/local/bin)
      .replaceAll("""<[^>]+>""", "")                      // removes HTML/XML tags (e.g. <div class="foo">)
      .replaceAll("""[0-9a-fA-F]{16,}""", "")             // removes hex strings of 16+ characters (e.g. SHA hashes, UUIDs without dashes)
      .replaceAll("""[A-Za-z0-9+/=]{40,}""", "")          // removes base64-like strings of 40+ alphanumeric/+/=/characters
      .replaceAll("""\b\d+\b""", "")                      // removes standalone numbers (digits not attached to words)
      .replaceAll("""\s{2,}""", " ")                      // collapses runs of 2+ whitespace characters into a single space
      .trim
  }

  def apply(manifest: Manifest, index: Index, objectStorage: ObjectStorage, typeDetector: TypeDetector, mimeTypeMapper: MimeTypeMapper, postgresClient: PostgresClient, languageDetector: ThreadLocal[LanguageDetector])(implicit ec: ExecutionContext): IngestionServices = new IngestionServices {
    override def recordIngestionEvent(event: IngestionEvent) = postgresClient.insertEvent(event)

    /***
      * Uses tika to return the iso639-1 language code for the given text. We only store codes where tikka has a high
      * confidence in the result to try and maintain index quality
      * See https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes for a list of codes
      * @param text
      * @return
      */
    def detectLanguage(fieldIdentifier: String, text: String): Option[String] = {
      // clean a large block of text in case the file starts with lots of junk
      val textToClean = text.take(50000)
      val cleanedText = cleanTextForLanguageDetection(textToClean)
      // Drop to just 10,000 characters to limit performance impact of language detection
      val result = languageDetector.get().detect(cleanedText.take(10000))
      if (result.isReasonablyCertain) {
        Some(result.getLanguage)
      } else {
        logger.info(s"Unable to detect language for text in $fieldIdentifier. Tika result: ${result.getLanguage} with confidence ${result.getRawScore}")
        None
      }
    }

    override def addTranslationTodo(blobUri: Uri, params: ExtractionParams): Either[Failure, Unit] = {
      manifest.addTranslationTodoToBlob(blobUri, params)
    }

    override def ingestEmail(context: EmailContext, sourceMimeType: String): Either[Failure, Unit] = {

      val uriParents: List[UriParent] = UriParent.createPairwiseChain(context.parents)

      val rootUri = uriParents.last.parent

      val intermediateResources = uriParents
        .collect { case p: UriParentPair => p }
        .map(p => Manifest.InsertDirectory(parentUri = p.parent, uri = p.child))

      val insertions = intermediateResources :+ Manifest.InsertEmail(context.email, context.parents.head)

      val subjectDetectedLanguage = detectLanguage(s"${context.email.uri.value} email subject", context.email.subject)
      val bodyDetectedLanguage = detectLanguage(s"${context.email.uri.value} email body", context.email.body)

      manifest.insert(insertions, rootUri).flatMap( _ =>
        // TODO once we get attempt everywhere we can remove the await
        index.ingestEmail(context.email, context.ingestion, sourceMimeType, context.parentBlobs, context.workspace, context.languages, subjectDetectedLanguage, bodyDetectedLanguage).awaitEither(10.second)
      )
    }

    override def ingestFile(context: FileContext, blobUri: Uri, path: Path, isFastLane: Boolean): Either[Failure, Blob] = {
      val ingestionMetaData = EventMetadata(blobUri.value, context.ingestion)
      postgresClient.insertMetadata(BlobMetadata(
        ingestId = context.ingestion,
        blobId = blobUri.value,
        fileSize = context.file.size.toInt,
        path = context.file.uri.value.substring(context.ingestion.length))
      )
      postgresClient.insertEvent(IngestionEvent(ingestionMetaData, IngestionEventType.HashComplete))

      // see if the Blob already exists in the manifest to avoid doing uneeded processing
      val blob: Either[Failure, Option[Blob]] = manifest.getBlob(blobUri).map(Some(_)).recoverWith {
        // successful DB query, but the blob isn't there
        case NotFoundFailure(_) => Right[Failure, Option[Blob]](None)
      }

      val upload = blob.flatMap { maybeBlob =>
        if (maybeBlob.isEmpty) {
          val result = objectStorage.create(blobUri.toStoragePath, path)
          result match {
            case Right(_) => postgresClient.insertEvent(IngestionEvent(ingestionMetaData, IngestionEventType.BlobCopy))
            case Left(failure: Failure) =>
              postgresClient.insertEvent(
                IngestionEvent(ingestionMetaData, IngestionEventType.BlobCopy, EventStatus.Failure, EventDetails.errorDetails(failure.msg))
              )
          }
          result
        } else {
          postgresClient.insertEvent(IngestionEvent(ingestionMetaData, eventType = IngestionEventType.ManifestExists))
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
        insertions = intermediateResources :+ Manifest.InsertBlob(
          context.file,
          blobUri,
          context.parentBlobs,
          mimeType,
          context.ingestion,
          context.languages.map(_.key),
          extractors,
          context.workspace,
          isFastLane
        )
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
        _ = postgresClient.insertEvent(
          IngestionEvent(ingestionMetaData, eventType = IngestionEventType.MimeTypeDetected, details = EventDetails.ingestionDataDetails(data, extractors))
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
