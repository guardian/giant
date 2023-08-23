package extraction.email.msg

import java.io.{ByteArrayInputStream, InputStream}
import java.nio.file.{Files, StandardCopyOption}
import java.security.DigestInputStream
import cats.syntax.either._
import com.auxilii.msgparser.OutlookMessageParser
import com.auxilii.msgparser.model.{OutlookFileAttachment, OutlookMessage, OutlookMsgAttachment}
import extraction.{ExtractionParams, Extractor}
import ingestion.IngestionContextBuilder
import model.manifest.{Blob, MimeType}
import model.{Email, Priority, Recipient, Sensitivity, Uri, _}
import org.apache.commons.io.FileUtils
import services.ingestion.IngestionServices
import services.{FingerprintServices, ScratchSpace, Tika}
import utils.attempt.{Failure, UnknownFailure}
import utils.{DateTimeUtils, Logging}

import java.util.stream.Collectors
import scala.jdk.CollectionConverters._

class MsgEmailExtractor(scratch: ScratchSpace, ingestionServices: IngestionServices, tika: Tika) extends Extractor with Logging {
  val mimeTypes = Set(
  "application/vnd.ms-outlook"
  )

  override def canProcessMimeType = mimeTypes.contains

  override def indexing = true
  override def priority = 4

  private def getHeaderValue(message: OutlookMessage, header: String): Option[String] = Option(message.getHeaders)
    .flatMap(_.lines.collect(Collectors.toList[String]).asScala.find(_.startsWith(s"$header:")))
    .map(_.stripPrefix(s"$header:").trim)
    .filter(!_.isEmpty)

  private def processMessage(blob: Blob, msg: OutlookMessage, params: ExtractionParams): Unit = {
    val uri = msg.getMessageId.hasTextOrNone().map(id => Uri(Email.cleanUri(id)))
    val from = Option(msg.getFromEmail).map(e => Recipient(Option(msg.getFromName), e))
    val sentAt = getHeaderValue(msg, "Date").flatMap(DateTimeUtils.rfc1123ToIsoDateString)
    val subject = Option(msg.getSubject).getOrElse("")

    val priority: Option[String] = getHeaderValue(msg, "X-Priority").map(v => Priority.withRfcValue(v))
    val sensitivity: Option[Sensitivity] = getHeaderValue(msg, "Sensitivity").flatMap(v => Sensitivity.withPstIdOption(v.toInt))

    val inReplyTo: List[String] = getHeaderValue(msg, "In-Reply-To").toList.flatMap(Email.cleanInReplyTo)
    val references: List[String] = getHeaderValue(msg, "References").toList.flatMap(Email.cleanInReplyTo)
    val recipients: List[Recipient] = msg.getRecipients.asScala
      .flatMap(r => Option(r.getAddress)
        .map(e => Recipient(Option(r.getName), e))).toList

    val attachments = msg.getOutlookAttachments.asScala
    val msgAttachments = attachments.collect { case m: OutlookMsgAttachment => m}
    val fileAttachments = attachments.collect { case f: OutlookFileAttachment => f }

    val body = msg.getBodyText
    val html = Option(msg.getBodyHTML).map(msgHtml => Email.inlineAttachmentsIntoHtml(msgHtml, fileAttachments.iterator)(a =>
      Option(a.getContentId).map { id =>
        (a.getMimeTag, id.removeChevrons(), new ByteArrayInputStream(a.getData))
      }
    ))

    val attachmentCount = msgAttachments.length + fileAttachments.count { attachment =>
      Option(attachment.getContentDisposition).forall(!_.startsWith("inline"))
    }

    val email = Email.createFrom(uri, from, recipients, sentAt, sensitivity, priority, subject, body, inReplyTo, references, html, attachmentCount)

    val context = IngestionContextBuilder(blob.uri, params).finishWithEmail(email)
    ingestionServices.ingestEmail(context, "application/vnd.ms-outlook")

    val attachmentBuilder = IngestionContextBuilder(email.uri, params)

    msgAttachments.foreach { m =>
      processMessage(blob, m.getOutlookMessage, params)
    }

    fileAttachments.foreach { attachment =>
      val attachmentStream = new ByteArrayInputStream(attachment.getData)
      val workingDir = scratch.createWorkingDir(s"emails/${email.uri.value}/")

      try {
        // Create Blob URI
        val localPath = workingDir.resolve(attachment.getLongFilename)
        val attachmentFile = scratch.copyToScratchSpace(localPath, attachmentStream)
        val blobUri = Uri(FingerprintServices.createFingerprintFromFile(attachmentFile))

        val mimeType = Option(attachment.getMimeTag)
          .getOrElse(tika.detectType(attachmentFile.toPath).map(_.toString)
            .getOrElse(throw new Exception("Failed to get MIME type for attachment")))

        // Ingest
        val blob = Blob(blobUri, attachmentFile.length(), Set(MimeType(mimeType)))

        val attachmentContext = attachmentBuilder.finishWithFile(attachmentFile.toPath)
        ingestionServices.ingestFile(attachmentContext, blob.uri, attachmentFile.toPath)
      } finally {
        attachmentStream.close()
        FileUtils.deleteDirectory(workingDir.toFile)
      }
    }
  }

  override def extract(blob: Blob, stream: InputStream, params: ExtractionParams): Either[Failure, Unit] = {
    println("*** trying to extract a .msg innit")
    processMessage(blob, new OutlookMessageParser().parseMsg(stream), params)
    Right(())
  }
}
