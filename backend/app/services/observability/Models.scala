package services.observability

import extraction.Extractor
import play.api.libs.json.{Format, Json}
import model.manifest.Blob
import org.apache.commons.codec.digest.DigestUtils
import org.joda.time.{DateTime, DateTimeZone}
import services.index.IngestionData
import services.observability.ExtractorType.ExtractorType
import services.observability.IngestionEventType.{IngestionEventType, RunExtractor}
import services.observability.EventStatus.EventStatus
import play.api.libs.json.JodaWrites.jodaDateWrites
import play.api.libs.json.JodaReads.jodaDateReads
import utils.Logging

import java.security.MessageDigest
import scala.util.{Failure, Try, Success => TrySuccess}

object JodaReadWrites {
  private val datePattern = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
  val dateWrites = jodaDateWrites(datePattern)
  val dateReads = jodaDateReads(datePattern)
}

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
    TesseractPdfOcrExtractor, ImageOcrExtractor, UnknownExtractor, TranscriptionExtractor = Value

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
case class IngestionErrorsWithEventType(eventType: IngestionEventType, errors: List[IngestionError])

object IngestionError extends Logging {
  implicit val format = Json.format[IngestionError]

  def parseIngestionErrors(errors: Array[String], eventTypes: Array[String]): List[IngestionErrorsWithEventType] = {
    errors.toList.zip(eventTypes.toList).flatMap{
      case (e, eventType) =>
      if (e == null) None else {
        Try(Json.parse(e).as[List[IngestionError]]) match {
          case TrySuccess(value) =>
            Some(IngestionErrorsWithEventType(IngestionEventType.withName(eventType), value))
          case Failure(exception: Throwable) =>
            logger.error("Failed to parse ingestion errors. Returning empty list", exception)
            None
        }
      }
    }
  }
}

object IngestionErrorsWithEventType {
  implicit val format = Json.format[IngestionErrorsWithEventType]
}


case class EventDetails(
                    errors: Option[List[IngestionError]] = None,
                    extractors: Option[List[ExtractorType]] = None,
                    blob: Option[Blob] = None,
                    ingestionData: Option[IngestionData] = None,
                    extractorName: Option[ExtractorType] = None,
                    workspaceName: Option[String] = None,
                    mimeTypes: Option[String] = None
                  )

object EventDetails {
  implicit val detailsFormat = Json.format[EventDetails]

  def errorDetails(message: String, stackTrace: Option[String] = None): Option[EventDetails] = Some(EventDetails(Some(List(IngestionError(message, stackTrace)))))

  def extractorErrorDetails(extractorName: String, message: String, stackTrace: String): Option[EventDetails] =
    Some(EventDetails(
      errors = Some(List(IngestionError(message, Some(stackTrace)))),
      extractorName = Some(ExtractorType.withNameCustom(extractorName)))
    )

  def ingestionDataDetails(data: IngestionData, extractors: List[Extractor]): Option[EventDetails] = Some(EventDetails(
    extractors = Some(extractors.map(e => ExtractorType.withNameCustom(e.name))),
    ingestionData = Some(data),
    mimeTypes = Some(data.mimeTypes.map(_.mimeType).mkString(","))
  ))

  def extractorDetails(extractorName: String): Option[EventDetails] = Some(EventDetails(extractorName = Some(ExtractorType.withNameCustom(extractorName))))

}

case class EventMetadata(blobId: String, ingestId: String)

object EventMetadata {
  implicit val format = Json.format[EventMetadata]
}

case class IngestionEvent(
                           metadata: EventMetadata,
                           eventType: IngestionEventType,
                           status: EventStatus = EventStatus.Success,
                           details: Option[EventDetails] = None
                         )
object IngestionEvent {
  implicit val metaDataFormat = Json.format[EventMetadata]
  implicit val ingestionEventFormat = Json.format[IngestionEvent]

  def workspaceUploadEvent(blobId: String, ingestUri: String, workspaceName: String, status: EventStatus): IngestionEvent = IngestionEvent(
    EventMetadata(blobId, ingestUri),
    IngestionEventType.WorkspaceUpload,
    status,
    Some(EventDetails(workspaceName = Some(workspaceName)))
  )
}

case class BlobMetadata(ingestId: String, blobId: String, path: String, fileSize: Long)

object BlobMetadata {
  implicit val blobMetaDataFormat = Json.format[BlobMetadata]
}

case class ExtractorStatusUpdate(eventTime: Option[DateTime], status: Option[EventStatus])
object ExtractorStatusUpdate {
  implicit val dateWrites = JodaReadWrites.dateWrites
  implicit val dateReads = JodaReadWrites.dateReads
  implicit val format = Json.format[ExtractorStatusUpdate]
}

case class IngestionEventStatus(eventTime: DateTime, eventType: IngestionEventType, eventStatus: EventStatus)
object IngestionEventStatus {
  implicit val dateWrites = JodaReadWrites.dateWrites
  implicit val dateReads = JodaReadWrites.dateReads
  implicit val format = Json.format[IngestionEventStatus]

  def parseEventStatus(eventTimes: Array[DateTime], eventTypes: Array[String], eventStatuses: Array[String]): List[IngestionEventStatus] = {
    val allEventStatuses =  eventTimes.lazyZip(eventTypes).lazyZip(eventStatuses).toList.map {
      case (eventTime, eventType, eventStatus) =>
        IngestionEventStatus(eventTime, IngestionEventType.withName(eventType), EventStatus.withName(eventStatus))
    }
    // discard extractor events as we have a separate ExtractorStatus field, and 'RunExtractor' by itself without context of which extractor isn't very helpful
    allEventStatuses.filter(es => es.eventType != RunExtractor)
  }
}


case class ExtractorStatus(extractorType: ExtractorType, statusUpdates: List[ExtractorStatusUpdate])
object ExtractorStatus {
  implicit val format = Json.format[ExtractorStatus]

  def parseDbStatusEvents(extractors: Array[String], extractorEventTimes: Array[String], extractorStatuses: Array[String]): List[ExtractorStatus] = {
    val statusUpdatesParsed: Seq[List[ExtractorStatusUpdate]] = extractorEventTimes.zip(extractorStatuses).map {
      case (times, statuses) => times.split(",").zip(statuses.split(",")).map{
        case (time, status) =>
          val eventTime = if (time == "null") None else Some(PostgresHelpers.postgresEpochToDateTime(time.toDouble))

          val parsedStatus = if (status == "null") None else Some(EventStatus.withName(status))
          ExtractorStatusUpdate(eventTime, parsedStatus)}.toList
    }.toList

    extractors.toList.zip(statusUpdatesParsed).map {case (extractor, statusUpdates) => ExtractorStatus(ExtractorType.withName(extractor), statusUpdates)

    }
  }
}

case class BlobStatus(
                       metadata: EventMetadata,
                       paths: List[String],
                       fileSize: Option[Long],
                       workspaceName: Option[String],
                       ingestStart: DateTime,
                       mostRecentEvent: DateTime,
                       eventStatuses: List[IngestionEventStatus],
                       extractorStatuses: List[ExtractorStatus],
                       errors: List[IngestionErrorsWithEventType],
                       mimeTypes: Option[String],
                       infiniteLoop: Boolean)
object BlobStatus {
  implicit val dateWrites = JodaReadWrites.dateWrites
  implicit val dateReads = JodaReadWrites.dateReads
  implicit val format = Json.format[BlobStatus]

  def parsePathsArray(paths: Array[String]): List[String] = {
    val nonNullPaths = paths.filter(p => p != null)
    if (nonNullPaths.isEmpty) {
      List("unknown filename")
    } else nonNullPaths.toList
  }

  /**
    * Aims to remove all information from blob status that is likely to identify the user who uploaded it or the file itself
    * @param status
    * @return
    */
  private def anonymise(status: BlobStatus): BlobStatus = {
    status.copy(
      paths = List("[REDACTED]"),
      workspaceName = status.workspaceName.map(DigestUtils.md5Hex)
    )
  }

  def anonymiseEventsOlderThanTwoWeeks(sortedStatuses: List[BlobStatus]): List[BlobStatus] = {
    sortedStatuses.map{ status =>
      if (status.ingestStart.isBefore(new DateTime().minusDays(14))) {
        anonymise(status)
      } else status
    }
  }
}