package services.observability

import extraction.Extractor
import model.ingestion.WorkspaceItemContext
import play.api.libs.json.{Format, Json}
import model.manifest.Blob
import org.joda.time.DateTime
import services.index.IngestionData
import services.observability.ExtractorType.ExtractorType
import services.observability.IngestionEventType.IngestionEventType
import services.observability.EventStatus.EventStatus
import play.api.libs.json.JodaWrites.jodaDateWrites
import play.api.libs.json.JodaReads.jodaDateReads


object IngestionEventType extends Enumeration {
  type IngestionEventType = Value

  val HashComplete, BlobCopy, ManifestExists, MimeTypeDetected, IngestFile, InitialElasticIngest, RunExtractor = Value

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

object EventStatus extends Enumeration {
  type EventStatus = Value

  val Started, Success, Failure = Value

  implicit val format: Format[EventStatus] = Json.formatEnum(this)
}

case class IngestionError(message: String, stackTrace: Option[String] = None)

object IngestionError {
  implicit val format = Json.format[IngestionError]
}

case class EventDetails(
                    errors: Option[List[IngestionError]] = None,
                    extractors: Option[List[ExtractorType]] = None,
                    blob: Option[Blob] = None,
                    ingestionData: Option[IngestionData] = None,
                    extractorName: Option[ExtractorType] = None,
                    workspaceItemContext: Option[WorkspaceItemContext] = None
                  )

object EventDetails {
  implicit val detailsFormat = Json.format[EventDetails]

  def errorDetails(message: String, stackTrace: Option[String] = None): Option[EventDetails] = Some(EventDetails(Some(List(IngestionError(message, stackTrace)))))

  def extractorErrorDetails(extractorName: String, message: String, stackTrace: Option[String] = None): Option[EventDetails] =
    Some(EventDetails(
      errors = Some(List(IngestionError(message, stackTrace))),
      extractorName = Some(ExtractorType.withNameCustom(extractorName)))
    )

  def ingestionDataDetails(data: IngestionData, extractors: List[Extractor]) = Some(EventDetails(
    extractors = Some(extractors.map(e => ExtractorType.withNameCustom(e.name))),
    ingestionData = Some(data)))

  def workspaceDetails(workspaceItemContext: Option[WorkspaceItemContext]) = Some(EventDetails(workspaceItemContext = workspaceItemContext))

  def extractorDetails(extractorName: String) = Some(EventDetails(extractorName = Some(ExtractorType.withNameCustom(extractorName))))

}

case class EventMetaData(blobId: String, ingestId: String)

object EventMetaData {
  implicit val format = Json.format[EventMetaData]
}

case class IngestionEvent(
                           metaData: EventMetaData,
                           eventType: IngestionEventType,
                           status: EventStatus = EventStatus.Success,
                           details: Option[EventDetails] = None
                         )
object IngestionEvent {
  implicit val metaDataFormat = Json.format[EventMetaData]
  implicit val ingestionEventFormat = Json.format[IngestionEvent]
}

case class BlobMetaData(ingestId: String, blobId: String, path: String, fileSize: Long)

object BlobMetaData {
  implicit val blobMetaDataFormat = Json.format[BlobMetaData]
}
case class BlobStatus(
                       metaData: EventMetaData,
                       path: String,
                       ingestStart: DateTime,
                       mostRecentEvent: DateTime,
                       extractorStatuses: List[(ExtractorType, EventStatus)],
                       errors: List[IngestionError])
object BlobStatus {
  implicit val dateWrites = jodaDateWrites("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
  implicit val dateReads = jodaDateReads("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
  implicit val format = Json.format[BlobStatus]
}