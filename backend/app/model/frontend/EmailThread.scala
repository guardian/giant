package model.frontend

import model.{Email, Recipient}

case class EmailThread(emails: List[List[ThreadEmail]])

// TODO attachments
case class ThreadEmail(uri: String, subject: String, inReplyTo: String, recipients: List[Recipient], hasHiddenOutgoing: Boolean)
