package extraction.email.olm

import java.io.InputStream
import java.util.zip.ZipInputStream

import extraction.email.CustomTikaDetector
import org.apache.tika.mime.MediaType

object OlmEmailDetector extends CustomTikaDetector {
  // TODO MRB: is there an actual registered OLM mime type? this is invented
  val OLM_MIME_TYPE = "application/vnd.ms-outlook-olm"

  override def detectType(input: InputStream): Option[MediaType] = {
    // maybe
    val zipInput = new ZipInputStream(input)
    Option(zipInput.getNextEntry) match {
      case Some(entry) if entry.getName == "Categories.xml" =>
        Some(MediaType.parse(OLM_MIME_TYPE))

      case _ =>
        None
    }
  }
}
