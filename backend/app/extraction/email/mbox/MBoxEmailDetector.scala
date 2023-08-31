package extraction.email.mbox

import java.io.InputStream
import java.io.InputStream
import java.util.Properties
import extraction.email.{CustomTikaDetector, JakartaMail}
import org.apache.tika.io.TikaInputStream
import org.apache.tika.mime.MediaType

import scala.util.control.NonFatal

/*
 * Not really a standard but pretty common place
 *  https://www.loc.gov/preservation/digital/formats/fdd/fdd000383.shtml
 */
object MBoxEmailDetector extends CustomTikaDetector {
  val MBOX_MIME_TYPE = "application/mbox"

  override def detectType(input: InputStream): Option[MediaType] = input match {
    case tikaInput: TikaInputStream =>
      val url = s"mbox:${tikaInput.getFile.getAbsolutePath}"
      val mbox = JakartaMail.openStore(url)


      try {
        val messageCount = mbox.getMessageCount()
        if(messageCount >= 2) {
          Some(MediaType.parse(MBOX_MIME_TYPE))
        } else {
          logger.error(s"Mbox file had ${messageCount} messages - this could be because JakartaMail failed to properly open the MBOX file. ")
          None
        }
      } catch  {
        case NonFatal(e) =>
          logger.error("Failed to open mbox", e)
          None
      } finally {
        mbox.close()
      }

    case _ =>
      None
  }
}
