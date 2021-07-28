package extraction.email.olm

import java.io.File
import java.nio.file.{Files, Path, Paths, StandardCopyOption}
import java.security.DigestInputStream
import java.util.{Locale, UUID}

import extraction.{ExtractionParams, FileExtractor}
import ingestion.IngestionContextBuilder
import model.ingestion.{FileContext, IngestionFile}
import model.manifest.Blob
import model.{Email, Language, Uri}
import org.apache.commons.compress.archivers.zip.{ZipArchiveEntry, ZipFile}
import org.apache.commons.io.FileUtils
import services.ingestion.IngestionServices
import services.{FingerprintServices, ScratchSpace}
import utils.Logging
import utils.attempt.Failure

import scala.collection.JavaConverters._
import scala.collection.mutable.{Set => MutableSet}
import scala.xml.XML

class OlmEmailExtractor(scratch: ScratchSpace, ingestion: IngestionServices) extends FileExtractor(scratch) with Logging {
  override def canProcessMimeType = Set(OlmEmailDetector.OLM_MIME_TYPE).contains
  override def indexing = true
  override def priority = 3

  override def extract(blob: Blob, scratchFile: File, params: ExtractionParams): Either[Failure, Unit] = {
    logger.info(s"Running OLM extractor on '${blob.uri.value}'")

    val context = IngestionContextBuilder(blob.uri, params)

    val zipFile = new ZipFile(scratchFile)
    logger.info(s"Loaded OLM '${blob.uri.value}'")

    try {
      // Keep track of entries in the ZIP file we never ingested so we can ingest them as simple files
      val uningestedEntries = MutableSet.empty[String]
      val ingestedEntries = MutableSet.empty[String]

      val entries = zipFile.getEntries.asScala.toList
      entries.zipWithIndex.filterNot(_._1.isDirectory).foreach { case (entry, i) =>
        uningestedEntries.add(entry.getName)

        handleEntry(entries.length, i, entry, zipFile, context).foreach { entry =>
          uningestedEntries.remove(entry)
          ingestedEntries.add(entry)
        }
      }

      val standalone = scratch.createWorkingDir("standalone")
      uningestedEntries.diff(ingestedEntries).foreach { entry =>
        logger.info(s"Ingesting standalone OLM file $entry")
        ingestFile(standalone, Paths.get(entry).getFileName.toString, zipFile, zipFile.getEntry(entry), blob.uri, context)
      }

      Right(())
    } finally {
      zipFile.close()
    }
  }

  private def handleEntry(total: Int, i: Int, entry: ZipArchiveEntry, zipFile: ZipFile, rootContext: IngestionContextBuilder): Iterable[String] = {
    val isMessageFile = entry.getName.toLowerCase(Locale.UK).endsWith(".xml")

    if(isMessageFile) {
      val stream = zipFile.getInputStream(entry)
      val context = rootContext.pushParentDirectories(Paths.get(entry.getName))

      val xml = XML.load(stream)
      stream.close()
      val messages = (xml \\ "email").map(OlmMessage(_))

      if(messages.isEmpty) {
        // We don't understand this yet
        List.empty
      } else {
        messages.foreach { message =>
          val email = OlmMessage.toEmail(message)
          logger.info(s"Ingesting OLM email $i/$total ${entry.getName} ${email.uri}")

          val html = if (message.attachments.nonEmpty) {
            email.html.map(inlineAttachments(_, message.attachments, zipFile))
          } else {
            email.html
          }

          val emailContext = context.finishWithEmail(email.copy(
            html = html,
            metadata = Map("Original-Filename" -> Seq(entry.getName))
          ))

          ingestion.ingestEmail(emailContext, OlmEmailDetector.OLM_MIME_TYPE).left.foreach { e =>
            logger.error(s"Error ingesting OLM email $email.uri", e.toThrowable)
          }

          if(message.attachments.nonEmpty) {
            val emailContext = context.pushEmail(email.uri)
            handleAttachments(message.attachments, zipFile, email.uri, emailContext)
          }
        }

        entry.getName +: messages.flatMap(_.attachments.map(_.path))
      }
    } else {
      // Nothing ingested
      List.empty
    }
  }

  private def handleAttachments(attachments: List[OlmAttachment], zipFile: ZipFile, emailUri: Uri, emailContext: IngestionContextBuilder): Unit = {
    val scratchRoot = scratch.createWorkingDir(s"emails/${emailUri.value}/")

    try {
      attachments.foreach {
        case OlmAttachment(_, path, _, _) if path.isEmpty =>
          // TODO MRB: where are these files?
          logger.error(s"Missing path in attachment")

        case OlmAttachment(name, path, _, _) =>
          Option(zipFile.getEntry(path)) match {
            case Some(entry) =>
              ingestFile(scratchRoot, name, zipFile, entry, emailUri, emailContext)

            case None =>
              // TODO MRB: add this as a user facing attachment
              logger.error(s"Attachment $path is not in ZIP!")
          }
      }
    } finally {
      FileUtils.deleteDirectory(scratchRoot.toFile)
    }
  }

  private def ingestFile(scratchRoot: Path, name: String, zipFile: ZipFile, entry: ZipArchiveEntry, emailUri: Uri, context: IngestionContextBuilder): Unit = {
    // Create Blob URI
    val stream = zipFile.getInputStream(entry)

    try {
      val emailFile = scratch.copyToScratchSpace(stream)
      logger.info(s"Copying $name to scratch ${emailFile.toString}")

      val blobUri = Uri(FingerprintServices.createFingerprintFromFile(emailFile))
      val fileContext = buildFileContext(name, emailFile.toPath, emailUri, entry, context)

      logger.info(s"Ingesting ${emailUri.value}/$name")

      ingestion.ingestFile(fileContext, blobUri, emailFile.toPath).left.foreach { e =>
        logger.error(s"Error ingesting ${emailUri.value}/$name", e.toThrowable)
      }
    } finally {
      stream.close()
    }
  }

  private def buildFileContext(name: String, fileOnDisk: Path, parentUri: Uri, entry: ZipArchiveEntry, emailContext: IngestionContextBuilder): FileContext = {
    emailContext.finishWithFile(
      IngestionFile(
        uri = parentUri.chain(name),
        parentUri = parentUri,
        size = Files.size(fileOnDisk),
        lastAccessTime = Option(entry.getLastAccessTime),
        lastModifiedTime = Option(entry.getLastModifiedTime),
        creationTime = Option(entry.getCreationTime),
        isRegularFile = false
      )
    )
  }

  private def inlineAttachments(html: String, attachments: List[OlmAttachment], zipFile: ZipFile): String = {
    Email.inlineAttachmentsIntoHtml(html, attachments.iterator) {
      case OlmAttachment(_, path, Some(contentId), Some(contentType)) =>
        Option(zipFile.getEntry(path)).map { entry =>
          (contentType, contentId, zipFile.getInputStream(entry))
        }

      case _ =>
        None
    }
  }
}
