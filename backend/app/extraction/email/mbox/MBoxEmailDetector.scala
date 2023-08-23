package extraction.email.mbox

import java.io.InputStream
import java.io.InputStream
import java.util.Properties
import extraction.email.{CustomTikaDetector, JakartaMail}
import org.apache.tika.io.TikaInputStream
import org.apache.tika.mime.MediaType

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

      println("*******FOUND AN MBOX great")

      try {
        val messageCount = mbox.getMessageCount()
        println("*******Number of messages:" + messageCount)

        if(messageCount >= 2) {
          Some(MediaType.parse(MBOX_MIME_TYPE))
        } else {
          None
        }
      } finally {
        mbox.close()
      }

    case _ =>
      None
  }
}
