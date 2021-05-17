package extraction

import java.io.InputStream

import model.manifest.Blob
import services.Tika
import services.index.Index
import utils.Logging
import utils.attempt.AttemptAwait._
import utils.attempt.{Failure, UnsupportedOperationFailure}

import scala.concurrent.ExecutionContext

class DocumentBodyExtractor(tika: Tika, index: Index)(implicit ec: ExecutionContext) extends Extractor with Logging {
  val mimeTypes: Set[String] = Set(
    "application/html",
    "application/json",
    "application/msword",
    "application/pdf",
    "application/rtf",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/x-tika-msoffice",
    "application/xml",
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "text/html",
    "text/plain",
    "text/vcard",
    "text/x-vcard",
    "text/xhtml"
  ) ++ tika.documentTypes

  def canProcessMimeType = mimeTypes.contains

  override def indexing = true
  override def priority = 5

  override def extract(blob: Blob, stream: InputStream, params: ExtractionParams): Either[Failure, Unit] = {
    logger.info(s"Running document body extractor on '${blob.uri.value}'")

    // Tika will fallback to using the file extension to determine the MIME type so the same blob seen in different
    // locations under different names can be detected as multiple different types. We have seen this in production
    // with `.ics` files dectected as both `text/plain` and `text/calendar`. For now, just use the first MIME type.
    val mimeType = blob.mimeType.head.mimeType

    if(passesSafetyCheck(mimeType, blob.size)) {
      tika.parse(stream, mimeType).flatMap { case (metadata, body) =>
        val rawMetadata = metadata.names().map(name => name -> metadata.getValues(name).toSeq).toMap
        val enrichedMetadata = MetadataEnrichment.enrich(rawMetadata)
        // Optionally having a body will allow documents without text to default to preview, useful for un-OCR'd documents
        val optionalBody = if (body.trim().isEmpty) None else Some(body)

        index.addDocumentDetails(blob.uri, optionalBody, rawMetadata, enrichedMetadata, params.languages).awaitEither()
      }
    } else {
      Left(UnsupportedOperationFailure("Failed safety check"))
    }
  }

  // We have seen Tika identify big (ie tens of gigabytes) binary device images as text/plain. These cause OOM exceptions
  // building up their string contents so we limit the amount of text written to 90MB. We chose this because the maximum
  // Elasticsearch request size is 100MB (minus some overhead). The key is that we mark it as an extraction failure so
  // that users know the file has not been processed successfully.
  private def passesSafetyCheck(mimeType: String, size: Long): Boolean = {
    (mimeType != "text/plain") || (size < (90 * 1024 * 1024))
  }
}
