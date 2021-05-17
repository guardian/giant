package extraction.email

import java.io.InputStream

import org.apache.tika.detect.Detector
import org.apache.tika.metadata.Metadata
import org.apache.tika.mime.MediaType
import utils.Logging

import scala.util.control.NonFatal


trait CustomTikaDetector extends Detector with Logging {
  // There's no particular logic for picking this size. I just guessed. I don't think Tika would break if it were different.
  private val OneMeg = 1024 * 1024

  def detectType(input: InputStream): Option[MediaType]

  final override def detect(input: InputStream, metadata: Metadata): MediaType = {
    if(input == null) {
      return MediaType.OCTET_STREAM
    }

    try {
      // The Tika javadoc asks us to mark the stream, presumably so that it can rewind after detection
      input.mark(OneMeg)

      // This is Tikas contract for "I don't know what this is"
      detectType(input).getOrElse(MediaType.OCTET_STREAM)
    } catch {
      case NonFatal(e) =>
        logger.info(s"${this.getClass.getName} rejected input due to $e")
        MediaType.OCTET_STREAM
    } finally {
      input.reset()
    }
  }
}
