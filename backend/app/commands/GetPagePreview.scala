package commands

import org.apache.pekko.stream.scaladsl.StreamConverters
import model.{Language, Uri}
import play.api.http.HttpEntity
import services.ObjectStorage
import services.previewing.PreviewService
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

class GetPagePreview(uri: Uri, language: Language, pageNumber: Int,
                     previewStorage: ObjectStorage)(implicit ec: ExecutionContext) extends AttemptCommand[HttpEntity] {
  override def process(): Attempt[HttpEntity] = {
    val previewUri = PreviewService.getPageStoragePath(uri, language, pageNumber)

    for {
      pageData <- previewStorage.get(previewUri).toAttempt
    } yield {
      // StreamConverters.fromInputStream will close the stream for us once it's done
      // HttpEntity comes from Play and expects an akka ByteString so here we use akka here
      HttpEntity.Streamed(StreamConverters.fromInputStream(() => pageData), None, Some("application/pdf"))
    }
  }
}
