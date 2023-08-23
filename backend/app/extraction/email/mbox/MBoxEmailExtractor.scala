package extraction.email.mbox

import extraction.email.JakartaMail

import java.io.File
import extraction.{ExtractionParams, FileExtractor}
import extraction.email.eml.EmlParser
import ingestion.IngestionContextBuilder
import model.manifest.Blob
import utils.Logging
import utils.attempt.Failure

import java.util.Properties
import scala.util.control.NonFatal

class MBoxEmailExtractor(emlParser: EmlParser) extends FileExtractor(emlParser.scratch) with Logging {
  override def canProcessMimeType = Set(MBoxEmailDetector.MBOX_MIME_TYPE).contains
  override def indexing: Boolean = true
  override def priority = 3
  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {

    println("****Trying to extract an mbox innit, counting the messages")
    val context = IngestionContextBuilder(blob.uri, params)
    val folder = JakartaMail.openStore(s"mbox:${file.getAbsolutePath}")
    println("**HI")
    println(folder.getMessageCount())

    try {
      folder.getMessages.zipWithIndex.foreach { case (message, ix) =>
          val (email, attachments) = emlParser.parseMessage(message).getOrElse {
            logger.error(s"Message $ix in mbox file (${blob.uri}) content was not multipart or string!")
            throw new Exception(s"Message $ix in mbox file (${blob.uri}) content was not multipart or string!")
          }

          emlParser.ingestionServices.ingestEmail(context.finishWithEmail(email), MBoxEmailDetector.MBOX_MIME_TYPE)

          val attachmentBuilder = IngestionContextBuilder(email.uri, params)
          attachments.foreach { a =>
            emlParser.ingestAttachment(attachmentBuilder, email, a)
          }
      }

      Right(())
    } finally {
      folder.close()
    }
  }
}
