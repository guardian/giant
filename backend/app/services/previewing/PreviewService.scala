package services.previewing

import java.io.{ByteArrayInputStream, InputStream}
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import enumeratum.EnumEntry.Snakecase
import enumeratum.{EnumEntry, PlayEnum}
import model.index.{Document, IndexedResource}
import model.{Email, Language, ObjectData, ObjectMetadata, Uri}
import services.index.Index
import services.{ObjectStorage, PreviewConfig}
import utils.attempt.{Attempt, NotFoundFailure, PreviewNotSupportedFailure, UnsupportedOperationFailure}

import scala.concurrent.{ExecutionContext, Future}

// TODO MRB: The calling code has a BasicResource (thanks to the GetResource check it does anyway for permissions)
//           At the moment that doesn't have the MIME types so we need to do another lookup here in the index. It would
//           be cleaner if we could just pass that down and avoid the extra lookup here (and getResource on the index
//           will also load all the text, which could be quite a lot, into memory only to discard it)
trait PreviewService {
  def getPreviewType(uri: Uri): Attempt[String]
  def generatePreview(uri: Uri): Attempt[Unit]
  def getPreviewObject(uri: Uri): Attempt[ObjectData]
}

class DefaultPreviewService(index: Index, blobStorage: ObjectStorage, previewStorage: ObjectStorage,
                            htmlPreview: HtmlPreviewGenerator, libreOfficePreview: LibreOfficePreviewGenerator)(implicit ec: ExecutionContext)

  extends PreviewService  {

  override def getPreviewType(uri: Uri): Attempt[String] = index.getResource(uri, highlightTextQuery = None).flatMap {
    case d: Document =>
      // Check and see if we already have a preview generated. This might be the case even if the blob can be
      // passed directly to the client (eg ImageOcrExtractor rendering a PDF of the image with selectable text)
      previewStorage.getMetadata(uri.toStoragePath).map(_.mimeType).toAttempt.recoverWith {
        case _: NotFoundFailure =>
          // Can we preview this type of document at all?
          PreviewService.previewStatus(d.mimeTypes) match {
            case PreviewStatus.PassThrough if d.mimeTypes.nonEmpty =>
              // The client can render it natively
              Attempt.Right(d.mimeTypes.head)
            case PreviewStatus.PdfGenerated =>
              // We can convert this file to a PDF to preview
              Attempt.Right("application/pdf")
            case _ =>
              Attempt.Left(PreviewNotSupportedFailure)
          }
      }

    case e: Email =>
      e.html match {
        case Some(_) => Attempt.Right("application/pdf")
        case _ => Attempt.Left(PreviewNotSupportedFailure)
      }
  }

  override def generatePreview(uri: Uri): Attempt[Unit] = for {
    resource <- index.getResource(uri, highlightTextQuery = None)
    _ <- getPreviewObjectGeneratingItIfRequired(resource, uri.toStoragePath)
  } yield {
    ()
  }

  override def getPreviewObject(uri: Uri): Attempt[ObjectData] = for {
    resource <- index.getResource(uri, highlightTextQuery = None)
    data <- getPreviewObjectGeneratingItIfRequired(resource, uri.toStoragePath)
  } yield {
    data
  }

  private def getPreviewObjectGeneratingItIfRequired(resource: IndexedResource, storagePathInS3: String): Attempt[ObjectData] = {
    // Check and see if we already have a preview generated. This might be the case even if the blob can be
    // passed directly to the client (eg ImageOcrExtractor rendering a PDF of the image with selectable text)
    getObjectData(storagePathInS3, previewStorage).recoverWith {
      case _: NotFoundFailure =>
        // No preview, can we pass it straight back to the client?
        resource match {
          case doc: Document if !PreviewService.requiresConversion(doc.mimeTypes) =>
            // If your blob is a pass-through type, simply stream the data back to the client
            getObjectData(storagePathInS3, blobStorage)

          case _ => for {
            // Generate a preview!
            _ <- runGeneratorOnResource(resource, storagePathInS3)

            // Return the newly generated preview
            data <- getObjectData(storagePathInS3, previewStorage)
          } yield {
            data
          }
        }
    }
  }

  private def runGeneratorOnResource(resource: IndexedResource, storagePathInS3: String): Attempt[Unit] = resource match {
    case e: Email if e.html.isEmpty =>
      Attempt.Left(NotFoundFailure(s"Email exists but does not have any HTML"))

    case e: Email =>
      // maybe
      val content = new ByteArrayInputStream(e.html.get.getBytes(StandardCharsets.UTF_8))
      runGeneratorOnInputStream(e.uri.toStoragePath, htmlPreview, content)

    case doc: Document =>
      blobStorage.get(storagePathInS3).toAttempt.flatMap { blobData =>
        if(doc.mimeTypes.exists(libreOfficePreview.isSupported)) {
          runGeneratorOnInputStream(doc.uri.toStoragePath, libreOfficePreview, blobData)
        } else {
          Attempt.Left[Unit](UnsupportedOperationFailure(s"Libreoffice cannot convert '${doc.mimeTypes.mkString(", ")}' to a PDF"))
        }
        // need to close blobData?
      }

    case _ =>
      Attempt.Left[Unit](UnsupportedOperationFailure("You can only generate a preview for email or document resources."))
  }

  private def runGeneratorOnInputStream(storagePathInS3: String, generator: PreviewGenerator, is: InputStream): Attempt[Unit] = for {
    localPathToGeneratedPreview <- generator.generate(is)
    _ <- previewStorage.create(storagePathInS3, localPathToGeneratedPreview, mimeType = Some("application/pdf")).toAttempt
  } yield {
    // close is here?
    Future { Files.delete(localPathToGeneratedPreview) } // asynchronously delete the file now it is in
    Right(()) // signal we are done immediately
  }

  private def getObjectData(key: String, storage: ObjectStorage): Attempt[ObjectData] = for {
    metadata <- storage.getMetadata(key).toAttempt
    data <- storage.get(key).toAttempt
  } yield {
    ObjectData(data, metadata)
  }
}

sealed abstract class PreviewStatus extends EnumEntry with Snakecase
object PreviewStatus extends PlayEnum[PreviewStatus] {
  case object Disabled extends PreviewStatus
  case object PassThrough extends PreviewStatus
  case object PdfGenerated extends PreviewStatus
  val values = findValues
}

object PreviewService {
  // TODO MRB: this assumes that all clients support the same mime types
  private val passthrough = Set("application/pdf", "image/jpeg", "image/gif", "image/png")

  def previewStatus(mimeTypes: Set[String]): PreviewStatus = {
    val isVideo = mimeTypes.exists(_.startsWith("video/"))
    val isAudio = mimeTypes.exists(_.startsWith("audio/"))
    val isBrowserRenderable = mimeTypes.exists(passthrough.contains)


    val canPassThrough = isVideo || isAudio || isBrowserRenderable
    val canGeneratePdf = mimeTypes.exists { mimeType =>
      LibreOfficePreviewGenerator.isSupported(mimeType)
    }

    (canPassThrough, canGeneratePdf) match {
      case (true, _) => PreviewStatus.PassThrough
      case (_, true) => PreviewStatus.PdfGenerated
      case (false, false) => PreviewStatus.Disabled
    }
  }

  def requiresConversion(mimeTypes: Set[String]): Boolean = {
    previewStatus(mimeTypes) != PreviewStatus.PassThrough
  }

  def getPageStoragePath(blobUri: Uri, language: Language, pageNumber: Int): String = {
    s"pages/${language.key}/${blobUri.toStoragePath}/${pageNumber}.pdf"
  }

  def apply(preview: PreviewConfig, index: Index, blobStorage: ObjectStorage, previewStorage: ObjectStorage)(implicit ec: ExecutionContext): PreviewService = {
    val workspace = Paths.get(preview.workspace)
    Files.createDirectories(workspace)

    val html = new HtmlPreviewGenerator(preview.chromiumBinary, workspace)
    val libreOffice = new LibreOfficePreviewGenerator(preview.libreOfficeBinary, workspace)

    new DefaultPreviewService(index, blobStorage, previewStorage, html, libreOffice)
  }
}