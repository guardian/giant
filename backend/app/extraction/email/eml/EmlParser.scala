package extraction.email.eml

import java.io.InputStream
import java.nio.file.attribute.FileTime
import java.nio.file.{Files, StandardCopyOption}
import java.security.DigestInputStream

import com.amazonaws.util.IOUtils
import com.google.common.net.MediaType
import ingestion.IngestionContextBuilder
import jakarta.mail.Message
import jakarta.mail.internet._
import model._
import model.manifest.{Blob, MimeType}
import org.apache.commons.io.FileUtils
import services.ingestion.IngestionServices
import services.{FingerprintServices, ScratchSpace}
import utils.{HtmlToPlainText, DateTimeUtils, Logging}

import scala.jdk.CollectionConverters._
import scala.util.control.NonFatal

class EmlParser(val scratch: ScratchSpace, val ingestionServices: IngestionServices) extends Logging {
  def parseMessage(message: Message): Option[(Email, Seq[MimeBodyPart])] = {
    val uri = getMessageUri(message)

    val senderAddress = Option(message.getFrom).flatMap(_.headOption.map(_.asInstanceOf[InternetAddress]))
    val from = senderAddress.map { addr => Recipient(Option(addr.getPersonal), addr.getAddress) }

    val sentAt = Option(message.getHeader("Date")).flatMap(_.headOption.flatMap(DateTimeUtils.rfc1123ToIsoDateString))

    val subject = Option(message.getSubject).map(MimeUtility.decodeText).orNull

    val priority: Option[String] = Option(message.getHeader("X-Priority")).flatMap(_.headOption.map(v => Priority.withRfcValue(v)))
    val sensitivity: Option[Sensitivity] = Option(message.getHeader("Sensitivity")).flatMap(_.headOption.flatMap(v => Sensitivity.withRfcOption(v)))

    val inReplyTo: List[String] = Option(message.getHeader("In-Reply-To")).map(_.toList).getOrElse(Nil)
    val references: List[String] = Option(message.getHeader("References")).map(_.toList).getOrElse(Nil)
    val recipients: List[Recipient] = Option(message.getAllRecipients).map(_.toList).getOrElse(Nil)
      .collect { case c: InternetAddress => c }
      .flatMap { r => Option(r.getAddress).map(Recipient(Option(r.getPersonal), _)) }

    message.getContent match {
      case content: MimeMultipart =>
        val parts = (for (a <- 0 until content.getCount) yield content.getBodyPart(a))
          .collect { case p: MimeBodyPart => p }
          .flatMap(flattenMultipart)

        val attachments = parts.filter(p => p.getEncoding.toLowerCase() == "base64" && getFilename(p).nonEmpty)
        val nonAttachments = parts.filter(p => getFilename(p).isEmpty)

        val bodyPart = nonAttachments.find(_.getContentType.toLowerCase().startsWith("text/plain"))
        val htmlPart = nonAttachments.find(_.getContentType.toLowerCase().startsWith("text/html"))

        val body = (bodyPart, htmlPart) match {
          case (Some(body), _) => body.getContent.asInstanceOf[String]
          case (None, Some(html)) => HtmlToPlainText.convert(html.getContent.asInstanceOf[String])
          case _ => ""
        }

        val html: Option[String] = htmlPart
          .map(_.getContent.asInstanceOf[String])
          .map(Email.inlineAttachmentsIntoHtml(_, attachments.iterator)(a =>
            Option(a.getContentID).map { id =>
              (a.getContentType, id.removeChevrons(), a.getInputStream)
            }
          ))

        val attachmentCount = attachments.flatMap(getRawContentDisposition).count(!_.startsWith("inline"))
        val email = Email.createFrom(uri, from, recipients, sentAt, sensitivity, priority, subject, body, inReplyTo, references, html, attachmentCount)

        Some((email, attachments))

      case plainText: String =>
        val email = Email.createFrom(uri, from, recipients, sentAt, sensitivity, priority, subject, plainText, inReplyTo, references, None, 0)
        Some((email, Nil))

      case is: InputStream =>
        // Just a single attachment, no message text body

        val headers = new InternetHeaders()
        headers.addHeader("Content-Type", message.getContentType)
        headers.addHeader("Content-Disposition", message.getDisposition)

        val email = Email.createFrom(uri, from, recipients, sentAt, sensitivity, priority, subject, "<empty>", inReplyTo, references, None, 0)
        val attachment = new MimeBodyPart(headers, IOUtils.toByteArray(is))

        Some((email, Seq(attachment)))

      case other =>
        logger.info(s"Unknown EML message content type ${other.getClass}")
        None
    }
  }

  def getMessageUri(message: Message): Option[Uri] = message match {
    case mimeMessage: MimeMessage =>
      Option(mimeMessage.getMessageID).map(id => Uri(Email.cleanUri(id))).filter(_.value.trim.nonEmpty)

    case _ =>
      None
  }

  def ingestAttachment(context: IngestionContextBuilder, email: Email, attachment: MimeBodyPart): Unit = {
    val attachmentStream = attachment.getInputStream
    val attachmentRoot = scratch.createWorkingDir(s"emails/${email.uri.value}/")

    try {
      val name = getFilename(attachment).getOrElse(throw new IllegalArgumentException(s"Missing Content-Disposition for attachment in ${email.uri}"))
      val rawContentType = attachment.getContentType
      val semicolonIndex = rawContentType.indexOf(";")
      val mimeType = if (semicolonIndex > 0) rawContentType.substring(0, semicolonIndex) else rawContentType

      // Create Blob URI
      val attachmentFile = scratch.copyToScratchSpace(attachmentStream)
      val blobUri = Uri(FingerprintServices.createFingerprintFromFile(attachmentFile))

      // Ingest
      val blob = Blob(blobUri, attachmentFile.length(), Set(MimeType(mimeType)))

      // https://tools.ietf.org/html/rfc2183
      val creationTime = headerDateToFileTime(attachment, "Creation-Date").orElse(email.sentAtMillis().map(FileTime.fromMillis))
      val lastAccessTime = headerDateToFileTime(attachment, "Read-Date")
      val lastModificationTime = headerDateToFileTime(attachment, "Modification-Date")

      val attachmentContext = context.finish(name, attachmentFile.toPath, creationTime, lastAccessTime, lastModificationTime)
      ingestionServices.ingestFile(attachmentContext, blob.uri, attachmentFile.toPath)
    } finally {
      attachmentStream.close()
      FileUtils.deleteDirectory(attachmentRoot.toFile)
    }
  }

  private def headerDateToFileTime(attachment: MimeBodyPart, name: String): Option[FileTime] = {
    Option(attachment.getHeader(name))
      .flatMap(_.headOption.flatMap(DateTimeUtils.rfc1123ToEpochMillis))
      .map(FileTime.fromMillis)
  }

  private def flattenMultipart(part: MimeBodyPart): List[MimeBodyPart] = {
    part.getContent match {
      case p: MimeMultipart =>
        (for (a <- 0 until p.getCount) yield p.getBodyPart(a)).collect { case p: MimeBodyPart => p }.flatMap(flattenMultipart).toList
      case _ =>
        List(part)
    }
  }

  private def getParameter(name: String, tpe: MediaType): Option[String] = {
    val params = tpe.parameters().asMap().asScala
    params.get(name).flatMap(_.asScala.headOption)
  }

  private val filenamesRegex = """filename\*\d+=\"(.+)\"""".r

  private def getRawContentDisposition(part: MimeBodyPart): Option[String] = {
    Option(part.getHeader("Content-Disposition", null))
  }

  private def getFilename(part: MimeBodyPart): Option[String] = try {
    Option(part.getFileName).map(MimeUtility.decodeText)
  } catch {
    case e: ParseException =>
      // Try to handle cases where javax.mail (even with strict off) can't hack it

      getRawContentDisposition(part).map { value =>
        // Try and handle folded filename entries, which may be UTF-8 base64 encoded.
        // I don't know how prevalent this is in the real world but I have seen it in a real dataset and the Platform for
        // Investigations is just a curated set of special cases right!!
        //
        // The format is:
        //   Content-Disposition: attachment;
        //    filename*0="=?UTF-8?B?<base 64 encoded stuff>"
        //    filename*1="<more base64 encoded stuff>?="
        //
        // Note the lack of "?=" terminator until right at the end. The values (when treated in aggregate) may or may
        // not be UTF-8 base-64 encoded.

        val encoded = filenamesRegex.findAllIn(value).matchData.map(_.group(1)).toList.mkString("")
        MimeUtility.decodeText(encoded)
      }
  }
}
