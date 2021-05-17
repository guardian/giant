package extraction.email.pst

import java.io.File
import java.nio.file.attribute.FileTime
import java.nio.file.{Files, StandardCopyOption}
import java.security.DigestInputStream
import java.util.UUID

import cats.syntax.either._
import com.pff._
import extraction.{ExtractionParams, FileExtractor}
import extraction.email.pst.iterators.AttachmentIterator
import ingestion.IngestionContextBuilder
import model.manifest.{Blob, MimeType}
import model.{Email, Language, Uri}
import org.apache.commons.io.FileUtils
import services.ingestion.IngestionServices
import services.{FingerprintServices, ScratchSpace}
import utils.Logging
import utils.attempt.{Failure, UnknownFailure}

import scala.collection.JavaConverters._
import scala.util.control.NonFatal

class PstEmailExtractor(scratch: ScratchSpace, ingestionServices: IngestionServices) extends FileExtractor(scratch) with Logging {
  val mimeTypes = Set(
    "application/vnd.ms-outlook-pst"
  )

  override def canProcessMimeType = mimeTypes.contains

  override def indexing: Boolean = true
  override def priority: Int = 3

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    // the PSTFile type has a finalizer to close the file handle
    val pstFile = new PSTFile(file)

    // We build a tree for the extracted emails - works a lot like the archive extractor
    val builder = IngestionContextBuilder(blob.uri, params)

    // Begin the descent
    Either.catchNonFatal {
      descendFolders(pstFile.getRootFolder, builder)
    }.leftMap(UnknownFailure.apply)
  }

  def descendFolders(f: PSTFolder, builder: IngestionContextBuilder): Unit = {
    if (f.hasSubfolders) {
      // breadth first tree traversal
      f.getSubFolders.asScala.foreach { folder =>
        descendFolders(
          folder,
          builder.pushDirectory(folder.getDisplayName)
        )
      }
    }

    val total = f.getContentCount
    (0 until f.getContentCount).foreach { i =>
      f.getNextChild match {
        case email: PSTMessage =>
          // Our library is throwing exceptions <3
          try {
            processEmail(email, builder)
          } catch {
            case NonFatal(ex) =>
              ex.printStackTrace()
              logger.error(s"Error while processing email - this should *ONLY* be exceptions from the PST processing library: ${ex.getMessage}")
          }

        case t if t != null => logger.warn(s"Unhandled PST Object ${t.getClass.toGenericString} in ${builder.progress.head.value}")
        case _ => // getNextChild can return null if you're at the end of the iterator which seems to happen
        // when you're looking over a .pst file's search root so we need to special case that
      }
    }
  }

  def processEmail(msg: PSTMessage, builder: IngestionContextBuilder): Unit = {
    val email = Email.fromPSTMessage(msg)
    ingestionServices.ingestEmail(builder.finishWithEmail(email), "application/vnd.ms-outlook-pst")

    val attachments = new AttachmentIterator(msg)
    val attachmentBuilder = builder.pushEmail(email.uri)

    attachments.foreach { attachment =>
      // We've had `getEmbeddedPSTMessage` throw some times we'll wrap the entire thing in a
      // try-catch so we can hopefully at least read the email body
      val maybeMessage = attachment.getEmbeddedPSTMessage
      if (maybeMessage != null) {
        // Found an attached email - process this with our current Email as the direct parent
        processEmail(maybeMessage, attachmentBuilder)
      } else {
        // Found a regular attachment
        val attachmentStream = attachment.getFileInputStream
        val workingDir = scratch.createWorkingDir(s"emails/${email.uri.value}/")

        try {
          val attachmentName = getAttachmentName(attachment)

          // Create Blob URI
          val localPath = workingDir.resolve(attachmentName)
          val attachmentFile = scratch.copyToScratchSpace(localPath, attachmentStream)
          val blobUri = Uri(FingerprintServices.createFingerprintFromFile(attachmentFile))

          // Ingest
          val blob = Blob(blobUri, attachmentFile.length(), Set(MimeType(attachment.getMimeTag)))

          val creationTime = Option(attachment.getCreationTime).map(_.getTime).orElse(email.sentAtMillis()).map(FileTime.fromMillis)
          val lastAccessTime = None
          val lastModificationTime = Option(attachment.getLastModificationTime).map(t => FileTime.fromMillis(t.getTime))

          val attachmentContext = attachmentBuilder.finish(attachmentName, localPath, creationTime, lastAccessTime, lastModificationTime)

          ingestionServices.ingestFile(attachmentContext, blob.uri, localPath)
        } finally {
          attachmentStream.close()
          FileUtils.deleteDirectory(workingDir.toFile)
        }
      }
    }
  }

  private def getAttachmentName(a: PSTAttachment): String = if (!a.getLongFilename.isEmpty) {
    a.getLongFilename.trim
  } else if (!a.getFilename.isEmpty) {
    a.getFilename.trim
  } else {
    logger.warn(s"Unnamed attachment found in .PST file")
    s"Unnamed attachment - ${UUID.randomUUID}"
  }
}
