package extraction

import java.io.InputStream

import model.ingestion.WorkspaceItemContext
import model.{Language, Uri}
import model.manifest.{Blob, MimeType}
import utils.attempt.Failure

case class ExtractionParams(ingestion: String, languages: List[Language], parentBlobs: List[Uri], workspace: Option[WorkspaceItemContext])

trait Extractor {
  def canProcessMimeType: String => Boolean

  def name: String = this.getClass.getSimpleName

  def indexing: Boolean

  def priority: Int

  def cost(mimeType: MimeType, size: Long): Long = size

  def extract(blob: Blob, inputStream: InputStream, params: ExtractionParams): Either[Failure, Unit]
}