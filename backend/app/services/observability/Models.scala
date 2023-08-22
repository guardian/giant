package services.observability

import extraction.Extractor
import model.ingestion.WorkspaceItemContext
import play.api.libs.json.{Format, Json}
import model.manifest.Blob
import org.joda.time.{DateTime, DateTimeZone}
import services.index.IngestionData
import services.observability.ExtractorType.ExtractorType
import services.observability.IngestionEventType.IngestionEventType
import services.observability.EventStatus.EventStatus
import play.api.libs.json.JodaWrites.jodaDateWrites
import play.api.libs.json.JodaReads.jodaDateReads

import java.time.ZonedDateTime


object IngestionEventType extends Enumeration {
  type IngestionEventType = Value

  val HashComplete, WorkspaceUpload, BlobCopy, ManifestExists, MimeTypeDetected, IngestFile, InitialElasticIngest, RunExtractor = Value

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

  val Unknown, Started, Success, Failure = Value

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
                    workspaceName: Option[String] = None
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

  def workspaceUploadEvent(blobId: String, ingestUri: String, workspaceName: String, status: EventStatus): IngestionEvent = IngestionEvent(
    EventMetaData(blobId, ingestUri),
    IngestionEventType.WorkspaceUpload,
    status,
    Some(EventDetails(workspaceName = Some(workspaceName)))
  )
}

case class BlobMetaData(ingestId: String, blobId: String, path: String, fileSize: Long)

object BlobMetaData {
  implicit val blobMetaDataFormat = Json.format[BlobMetaData]
}

case class ExtractorStatusUpdate(eventTime: DateTime, status: EventStatus)
object ExtractorStatusUpdate {
  implicit val dateWrites = jodaDateWrites("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
  implicit val dateReads = jodaDateReads("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
  implicit val format = Json.format[ExtractorStatusUpdate]
}


case class ExtractorStatus(extractorType: ExtractorType, statusUpdates: List[ExtractorStatusUpdate])
object ExtractorStatus {
  implicit val format = Json.format[ExtractorStatus]

  def parseDbStatusEvents(extractors: Array[String], extractorEventTimes: Array[String], extractorStatuses: Array[String]): List[ExtractorStatus] = {
    val statusUpdatesParsed = extractorEventTimes.zip(extractorStatuses).map {
      case (times, statuses) => times.split(",").zip(statuses.split(",")).map{
        case (time, status) =>
          val millisecondsSinceEpoch = (time.toDouble * 1000).toLong

          val parsedStatus = if (status == "null") EventStatus.Unknown else EventStatus.withName(status)
          ExtractorStatusUpdate(new DateTime(millisecondsSinceEpoch, DateTimeZone.UTC), parsedStatus)}.toList
    }.toList

    extractors.toList.zip(statusUpdatesParsed).map {case (extractor, statusUpdates) => ExtractorStatus(ExtractorType.withName(extractor), statusUpdates)

    }
  }
}

case class BlobStatus(
                       metaData: EventMetaData,
                       paths: List[String],
                       fileSize: Long,
                       workspaceName: Option[String],
                       ingestStart: DateTime,
                       mostRecentEvent: DateTime,
                       extractorStatuses: List[ExtractorStatus],
                       errors: List[IngestionError])
object BlobStatus {
  implicit val dateWrites = jodaDateWrites("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
  implicit val dateReads = jodaDateReads("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
  implicit val format = Json.format[BlobStatus]
}