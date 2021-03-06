package extraction.email.mbox

import java.io.InputStream

import extraction.email.{CustomTikaDetector, JavaMail}
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
      val mbox = JavaMail.openStore(url)

      try {
        // If it's got more than one messages, lets call it an mbox!
        // Yes they are 1-indexed.
        val mensajes = mbox.getMessages(1, 2)

        if(mensajes.length == 2) {
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
