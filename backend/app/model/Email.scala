package model

import java.io.InputStream
import java.security.MessageDigest
import java.util
import java.util.{Base64, Locale}
import com.pff._
import enumeratum.EnumEntry.Snakecase
import enumeratum.{EnumEntry, PlayEnum}
import extraction.email.pst.iterators.{AttachmentIterator, RecipientIterator}
import model.index.IndexedResource
import org.apache.commons.io.IOUtils
import play.api.libs.json._
import utils.{DateTimeUtils, Logging, UriCleaner}

import java.util.stream.Collectors
import scala.collection.JavaConverters.asScalaBufferConverter

object Priority {
  val NotUrgent = "not_urgent"
  val Normal = "normal"
  val Urgent = "urgent"

  def withPstIdOption(id: Int): Option[String] = id match {
    case -1 => Some(NotUrgent)
    case 0 => Some(Normal)
    case 1 => Some(Urgent)
    case _ => None
  }

  def withRfcValue(id: String): String = id match {
    case _ if id.startsWith("1") || id.startsWith("2") => Urgent
    case _ if id.startsWith("3") => Normal
    case _ if id.startsWith("4") || id.startsWith("5") => NotUrgent
    // cover cases where clients have written the priority as a string
    case _ => id.toLowerCase(Locale.UK)
  }
}

sealed abstract class Sensitivity(val pstId: Int) extends EnumEntry with Snakecase
object Sensitivity extends PlayEnum[Sensitivity] {
  case object None extends Sensitivity(0)
  case object Personal extends Sensitivity(1)
  case object Private extends Sensitivity(2)
  case object CompanyConfidential extends Sensitivity(3)
  val values = findValues
  def withPstIdOption(id: Int): Option[Sensitivity] = values.find(_.pstId == id)
  def withRfcOption(id: String): Option[Sensitivity] = id match {
    case "Personal" => Some(Personal)
    case "Private" => Some(Private)
    case "Company-Confidential" => Some(CompanyConfidential)
    case _ => scala.None
  }

}

case class Recipient (displayName: Option[String], email: String)

object Recipient {
  implicit val recipientFormat = Json.format[Recipient]

  val unknown = Recipient(Some("Unknown Recipient"), "unknown@recipient.com")

  def fromPSTRecipient(r: PSTRecipient) = Recipient(r.getDisplayName.hasTextOrNone(), r.getEmailAddress.removeChevrons())
}

case class Email(
                  uri: Uri,
                  from: Option[Recipient],
                  recipients: List[Recipient],
                  sentAt: Option[String],
                  sensitivity: Option[Sensitivity],
                  priority: Option[String],
                  subject: String,
                  body: String,
                  inReplyTo: List[String],
                  references: List[String],
                  html: Option[String],
                  attachmentCount: Int,
                  metadata: Map[String, Seq[String]],
                  flag: Option[String] = None) extends IndexedResource {
  def sentAtMillis(): Option[Long] = {
    sentAt.flatMap { ts =>
      DateTimeUtils.isoToEpochMillis(ts) orElse DateTimeUtils.isoMissingTimeZoneToMillis(ts)
    }
  }

  // Omit body from toString (to avoid filling up logs)
  override def toString: String = {
    s"Email(uri=$uri, from: $from, recipients: [${recipients.mkString(",")}], sentAt: $sentAt," +
      s"sensitivity: $sensitivity, priority: $priority, subject: $subject, inReplyTo: [${inReplyTo.mkString(",")}]" +
      s"references: [${references.mkString(",")}]"
  }
}

object Email extends Logging {
  implicit val format = Json.format[Email]

  def inlineAttachmentsIntoHtml[T](html: String, attachments: Iterator[T])(getContent: T => Option[(String, String, InputStream)]): String = {
    attachments.foldLeft(html) { (htmlText, a) =>
      getContent(a) match {
        case Some((mimeType, id, attachmentStream)) =>
          try {
            val bytes = IOUtils.toByteArray(attachmentStream)
            val encoded = Base64.getEncoder.encodeToString(bytes)
            htmlText.replace(s"cid:$id", s"data:$mimeType;base64,$encoded")
          } finally {
            attachmentStream.close()
          }

        case None =>
          htmlText
      }
    }
  }

  // trim to avoid trailing NUL characters from PSTs
  def cleanUri(original: String): String = UriCleaner.clean(original.removeChevrons())

  def cleanInReplyTo(original: String): List[String] = original.splitListClean(' ').map(_.removeChevrons())

  /**
    * An alternative endpoint that can be used if we are not certain we'll have a useful message ID.
    *
    * In this case if we don't have an explicit message ID we make a best effort to create one that is unique from the
    * information that we do have.
    *
    * We include the main components but have deliberately omitted some of the metadata flags. The aim is a good
    * balance between having enough entropy without causing problems if we change the way that some of the more
    * esoteric features are represented.
    */
  def createFrom(maybeUri: Option[Uri],
            from: Option[Recipient],
            recipients: List[Recipient],
            sentAt: Option[String],
            sensitivity: Option[Sensitivity],
            priority: Option[String],
            subject: String,
            body: String,
            inReplyTo: List[String],
            references: List[String],
            html: Option[String],
            attachmentCount: Int,
            metadata: Map[String, Seq[String]] = Map.empty,
            flag: Option[String] = None): Email = {
    val uri = maybeUri.getOrElse {
      val toBeHashed = s"$from/$recipients/$sentAt/$subject/$body/$inReplyTo/$references/$html"
      val uri = {
        val digest = MessageDigest.getInstance("SHA-512")
        digest.update(toBeHashed.getBytes("UTF-8"))
        Uri(s"no_id:${Base64.getUrlEncoder.withoutPadding.encodeToString(digest.digest())}")
      }
      logger.warn(s"Synthesised message ID $uri")
      uri
    }

    // ensure that the IDs for reply-to and references are clean and valid
    val cleanReplyTo = inReplyTo.map(_.trim).filter(_.nonEmpty)
    if (cleanReplyTo != inReplyTo) logger.warn(s"In-Reply-To list was cleaned up for $uri. Was: $inReplyTo Now: $cleanReplyTo")
    val cleanReferenced = references.map(_.trim).filter(_.nonEmpty)
    if (cleanReferenced != references) logger.warn(s"Referenced list was cleaned up for $uri. Was: $references Now: $cleanReferenced")

    Email(
      uri = uri,
      from = from,
      recipients = recipients,
      sentAt = sentAt,
      sensitivity = sensitivity,
      priority = priority,
      subject = subject,
      body = body,
      inReplyTo = cleanReplyTo,
      references = cleanReferenced,
      html = html,
      attachmentCount = attachmentCount,
      metadata = metadata,
      flag = flag
    )
  }

  def fromPSTMessage(message: PSTMessage) = {
    val inReplyTo = message.getInReplyToId.hasTextOrNone().toList.flatMap(Email.cleanInReplyTo)

    val headers = message.getTransportMessageHeaders
    val references = headers.lines.collect(Collectors.toList[String]).asScala.find(_.startsWith("References:")).map(_.stripPrefix("References:")).toList.flatMap(Email.cleanInReplyTo)

    val date = headers.lines.collect(Collectors.toList[String]).asScala.find(_.startsWith("Date:")).flatMap { date =>
      DateTimeUtils.rfc1123ToIsoDateString(date.stripPrefix("Date: ").trim())
    }

    val imageInlinedHtml = message.getBodyHTML.hasTextOrNone().map { rawHtml =>
      inlineAttachmentsIntoHtml(rawHtml, new AttachmentIterator(message))(a =>
        a.getContentId.hasTextOrNone().map { id =>
          (a.getMimeTag, id, a.getFileInputStream)
        }
      )
    }

    val attachmentCount = new AttachmentIterator(message).count(_.getContentId.isEmpty)

    Email.createFrom(
      maybeUri = message.getInternetMessageId.hasTextOrNone().map(id => Uri(cleanUri(id))),
      from = message.getSenderEmailAddress.hasTextOrNone().map(Recipient(message.getSenderName.hasTextOrNone(), _)),
      recipients = new RecipientIterator(message).map(Recipient.fromPSTRecipient).toList,
      sentAt = date,
      sensitivity = Sensitivity.withPstIdOption(message.getOriginalSensitivity),
      priority = Priority.withPstIdOption(message.getPriority),
      subject = message.getSubject.replace("\u0000", ""),
      body = message.getBody,
      inReplyTo = inReplyTo,
      references = references,
      html = imageInlinedHtml,
      attachmentCount = attachmentCount,
      metadata = Map.empty
    )
  }
}
