package extraction.email.eml


import extraction.email.JakartaMail
import cats.syntax.either._


import java.io.InputStream
import extraction.{ExtractionParams, Extractor}
import ingestion.IngestionContextBuilder
import model.Language
import model.manifest.Blob
import utils.Logging
import utils.attempt.{Failure, UnknownFailure}

class EmlEmailExtractor(emlParser: EmlParser) extends Extractor with Logging {
  val mimeTypes = Set(
    "message/rfc822"
  )

  override def canProcessMimeType = mimeTypes.contains
  override def indexing = true
  override def priority = 4

  override def extract(blob: Blob, stream: InputStream, params: ExtractionParams): Either[Failure, Unit] = {
    Either.catchNonFatal {
      val message = try {
        JakartaMail.parseMessage(stream)
      } finally {
        stream.close()
      }
      val (email, attachments) = emlParser.parseMessage(message).getOrElse {
        logger.error(s"EML file (${blob.uri}) content was not multipart or string!")
        throw new Exception(s"EML file (${blob.uri}) content was not multipart or string!")
      }

      val context = IngestionContextBuilder(blob.uri, params).finishWithEmail(email)
      emlParser.ingestionServices.ingestEmail(context, "message/rfc822")

      val attachmentBuilder = IngestionContextBuilder(email.uri, params)
      attachments.foreach { a =>
        emlParser.ingestAttachment(attachmentBuilder, email, a)
      }
    }.leftMap(UnknownFailure.apply)
  }
}
