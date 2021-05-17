package services
import java.nio.file.Path

import org.apache.tika.mime.MediaType
import utils.attempt.Failure

class TestTypeDetector(mimeType: String) extends TypeDetector {
  override def detectType(path: Path): Either[Failure, MediaType] = Right(MediaType.parse(mimeType))
}
