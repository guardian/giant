package extraction.email.olm

import model.{Email, Priority, Recipient, Uri}
import utils.HtmlToPlainText

import scala.xml.{Node, NodeSeq}

case class OlmMessage(
  messageId: Option[String],
  sender: Option[Recipient],
  recipients: List[Recipient],
  sentAt: Option[String],
  priority: Option[String],
  subject: String,
  inReplyTo: List[String],
  references: List[String],
  body: Option[String],
  html: Option[String],
  attachments: List[OlmAttachment]
)

case class OlmAttachment(
  name: String, // as it appears in the UI to the user
  path: String,  // where it actually is in the ZIP
  contentId: Option[String], // if it is referenced inline in the email,
  contentType: Option[String]
)

object OlmMessage {
  implicit class RichNodeSeq(nodeSeq: NodeSeq) {
    def textOption: Option[String] = Some(nodeSeq.text).filter(_.nonEmpty)
    def \@?(attribute: String): Option[String] = Some(nodeSeq \@ attribute).filter(_.nonEmpty)
  }

  def apply(node: Node): OlmMessage = {
    val maybeSender = (node \ "OPFMessageCopySenderAddress" \ "emailAddress").headOption
    val maybeCopyFrom = (node \ "OPFMessageCopyFromAddresses" \ "emailAddress").headOption
    val sender = (maybeSender orElse maybeCopyFrom).map(parseRecipient)

    val copyToAddresses = (node \ "OPFMessageCopyToAddresses" \ "emailAddress").map(parseRecipient).toList
    val copyCcAddresses = (node \ "OPFMessageCopyCCAddresses" \ "emailAddress").map(parseRecipient).toList
    val copyBccAddresses = (node \ "OPFMessageCopyBCCAddresses" \ "emailAddress").map(parseRecipient).toList

    val attachments = (node \ "OPFMessageCopyAttachmentList" \ "messageAttachment").map(OlmAttachment(_)).toList
    val meetingAttachments = (node \ "OPFMessageCopyMeetingData").textOption.flatMap(OlmAttachment.meetingData).toList

    OlmMessage(
      messageId = (node \ "OPFMessageCopyMessageID").textOption,
      sender = sender,
      recipients = copyToAddresses ++ copyCcAddresses ++ copyBccAddresses,
      sentAt = (node \ "OPFMessageCopySentTime").textOption,
      priority = parsePriority(node),
      subject = (node \ "OPFMessageCopySubject").text,
      inReplyTo = (node \ "OPFMessageCopyInReplyTo").textOption.toList,
      references = (node \ "OPFMessageCopyReferences").textOption.toList,
      body = (node \ "OPFMessageCopyBody").textOption,
      html = (node \ "OPFMessageCopyHTMLBody").textOption,
      attachments = attachments ++ meetingAttachments
    )
  }

  def parseRecipient(node: Node): Recipient = {
    val emailAddress = node \@ "OPFContactEmailAddressAddress"
    val displayName = node \@? "OPFContactEmailAddressName"
    Recipient(displayName, emailAddress)
  }

  def parsePriority(node: Node): Option[String] = {
    (node \ "OPFMessageGetPriority").textOption.map(_.trim.toInt).map {
      case normal if normal == 3 => Priority.Normal
      case urgent if urgent < 3 => Priority.Urgent
      case notUrgent if notUrgent > 3 => Priority.NotUrgent
    }
  }

  def toEmail(message: OlmMessage): Email = Email.createFrom(
    maybeUri = message.messageId.map(Email.cleanUri).map(Uri.apply),
    from = message.sender,
    recipients = message.recipients,
    sentAt = message.sentAt,
    sensitivity = None, // TODO MRB: parse sensitivity (if it exists)
    priority = message.priority,
    subject = message.subject,
    body = (message.body orElse message.html).map(HtmlToPlainText.convert).getOrElse("missing body"),
    inReplyTo = message.inReplyTo.flatMap(Email.cleanInReplyTo),
    references = message.references.flatMap(Email.cleanInReplyTo),
    html = message.html,
    attachmentCount = message.attachments.count(_.contentId.isEmpty)
  )
}

object OlmAttachment {
  import OlmMessage.RichNodeSeq

  def apply(node: Node): OlmAttachment = OlmAttachment(
    name = node \@ "OPFAttachmentName",
    path = node \@ "OPFAttachmentURL",
    contentId = node \@? "OPFAttachmentContentID",
    contentType = node \@? "OPFAttachmentContentType"
  )

  def meetingData(path: String): Option[OlmAttachment] = {
    if(path.endsWith(".ics")) {
      Some(OlmAttachment(
        name = "meeting.ics",
        path = path,
        contentId = None,
        contentType = Some("text/calendar")
      ))
    } else {
      // It seems that they are always .ics but better safe than sorry
      None
    }
  }
}