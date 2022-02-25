package commands

import akka.stream.scaladsl.StreamConverters
import model.{Language, Uri}
import play.api.http.HttpEntity
import services.ObjectStorage
import services.previewing.PreviewService
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

class GetPagePreview(uri: Uri, language: Language, pageNumber: Int, query: Option[String],
                     previewStorage: ObjectStorage)(implicit ec: ExecutionContext) extends AttemptCommand[HttpEntity] {
  override def process(): Attempt[HttpEntity] = {
    val previewUri = PreviewService.getPageStoragePath(uri, language, pageNumber)

    for {
      pageData <- previewStorage.get(previewUri).toAttempt
    } yield {
      // StreamConverters.fromInputStream will close the stream for us once it's done
      HttpEntity.Streamed(StreamConverters.fromInputStream(() => pageData), None, Some("application/pdf"))
    }
  }
}
