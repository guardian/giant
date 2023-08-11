package services.observability

import extraction.Extractor
import play.api.libs.json.{Format, Json}
import services.observability.ExtractorType.ExtractorType
import model.manifest.Blob
import org.apache.james.mime4j.dom.datetime.DateTime
import services.index.IngestionData
import services.observability.IngestionEventType.IngestionEventType
import services.observability.Status.Status



object IngestionEventType extends Enumeration {
  type IngestionEventType = Value

  val HashComplete, BlobCopy, ManifestExists, MimeTypeDetected, OcrComplete, ZipExtractionSuccess, PreviouslyProcessed = Value

  implicit val format: Format[IngestionEventType] = Json.formatEnum(this)
}

object ExtractorType extends Enumeration {
  type ExtractorType = Value

  val OlmEmailExtractor, ZipExtractor, RarExtractor, DocumentBodyExtractor,
    PstEmailExtractor, EmlEmailExtractor, MsgEmailExtractor, MBoxEmailExtractor,
    CsvTableExtractor, ExcelTableExtractor, OcrMyPdfExtractor, OcrMyPdfImageExtractor,
    TesseractPdfOcrExtractor, ImageOcrExtractor, UnknownExtractor = Value
  def withNameCustom(s: String): Value = {
    values.find(_.toString == s) match {
      case Some(value) => value
      case None => UnknownExtractor
    }
  }

  implicit val format: Format[ExtractorType] = Json.formatEnum(this)
}

object Status extends Enumeration {
  type Status = Value

  val Started, Success, Failure = Value

  implicit val format: Format[Status] = Json.formatEnum(this)
}

case class IngestionError(message: String, stackTrace: Option[String] = None)

object IngestionError {
  implicit val format = Json.format[IngestionError]
}

case class Details(
                    errors: Option[List[IngestionError]] = None,
                    extractors: Option[List[ExtractorType]] = None,
                    blob: Option[Blob] = None,
                    ingestionData: Option[IngestionData] = None
                  )

object Details {
  implicit val detailsFormat = Json.format[Details]

  def errorDetails(message: String, stackTrace: Option[String] = None) = Some(Details(Some(List(IngestionError(message, stackTrace)))))

  def ingestionDataDetails(data: IngestionData, extractors: List[Extractor]) = Some(Details(
    extractors = Some(extractors.map(e => ExtractorType.withNameCustom(e.name))),
    ingestionData = Some(data)))

}

case class IngestionEvent(
                           blobId: String,
                           ingestUri: String,
                           eventType: IngestionEventType,
                           status: Status = Status.Success,
                           details: Option[Details] = None
                         )
object IngestionEvent {
  implicit val ingestionEventFormat = Json.format[IngestionEvent]
}