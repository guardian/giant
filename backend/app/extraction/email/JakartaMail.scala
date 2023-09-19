package extraction.email


import jakarta.mail.internet.MimeMessage
import jakarta.mail.{Folder, Session, URLName}

import java.io.InputStream
import java.util.Properties

// Jakarta mail doesn't include mbox support out of the box so we compile a jar locally and check it in - see
// https://eclipse-ee4j.github.io/angus-mail/Mbox-Store for details
object JakartaMail {

  private val session: Session = Session.getInstance(properties(
    // case by case support for unusal MIME types seen in the wild and not directly supported by Java
    "mail.mime.contenttypehandler" -> "extraction.email.EmailContentTypeCleaner",
    // support https://tools.ietf.org/html/rfc6532
    "mail.mime.allowutf8" -> "true",
    // Put Java Mail into a more freewheeling mode and therefore more likely to handle illegal input
    "mail.mime.address.strict" -> "false",
    "mail.mime.decodetext.strict" -> "false",
    "mail.mime.parameters.strict" -> "false",
    "mail.mime.base64.ignoreerrors" -> "true",
    // Handle `?=` encoding in filenames
    "mail.mime.decodefilename" -> "true"
  ))

  def openStore(url: String): Folder = {
    val folder = session.getFolder(new URLName(url))
    folder.open(Folder.READ_ONLY)
    folder
  }

  def parseMessage(stream: InputStream): MimeMessage = {
    new MimeMessage(session, stream)
  }

  private def properties(props: (String, String)*): Properties = {
    // It's not fully clear from the documentation which properties should be passed to Session.getInstance and which
    // should be set as System properties. From looking at the Java mail source directly they are inconsistent about
    // where they read them from, in some cases reading from both in different places.
    // Lets play it on the safe-side and set every property in both the object and as a system property.
    val ret = new Properties()

    props.foreach { case (k, v) =>
      ret.setProperty(k, v)
      System.setProperty(k, v)
    }

    ret
  }

}
