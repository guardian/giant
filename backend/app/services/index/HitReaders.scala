package services.index

import com.sksamuel.elastic4s.requests.searches.SearchHit
import com.sksamuel.elastic4s.{Hit, HitReader}
import enumeratum.{EnumEntry, PlayEnum}
import extraction.EnrichedMetadata
import model.frontend.{DocumentResultDetails, EmailResultDetails, SearchResult}
import model.index._
import model.{Email, English, Language, Languages, Recipient, Sensitivity, Uri}
import services.events.{Event, EventFields, EventType}

import scala.util.control.NonFatal
import scala.util.{Failure, Success, Try}

object HitReaders {
  import IndexFields._

  import scala.language.implicitConversions

  type FieldMap = Map[String, Any]

  // TODO MRB: are these going to cause too many allocations?
  implicit class RichFieldMap(fields: FieldMap) {
    def field[T](name: String): T = fields(name).asInstanceOf[T]
    def longField(name: String): Long = fields(name) match {
      case i: java.lang.Long => i.toLong
      case i: java.lang.Integer => i.toLong
    }
    def doubleField(name: String): Double = fields(name) match {
      case f: java.lang.Double => f
    }
    def optField[T](name: String): Option[T] = fields.get(name).flatMap(Option(_)).map(_.asInstanceOf[T])
    def optLongField(name: String): Option[Long] = if(fields.contains(name)) { Some(longField(name)) } else { None }
    def listField[T](name: String): List[T] = optField[List[T]](name).getOrElse(Nil)
    def setField[T](name: String): Set[T] = optField[List[T]](name).map(_.toSet).getOrElse(Set.empty)
    def optEnumField[T <: EnumEntry](name: String, playEnum: PlayEnum[T]): Option[T] = optField(name).flatMap(playEnum.withNameOption)
    def objectField(name: String): FieldMap = field[FieldMap](name)
    def nestedField(name: String): Map[String, Seq[String]] = {
      val base = Map.empty[String, Seq[String]]

      optField[List[FieldMap]](name).getOrElse(List.empty).foldLeft(base) { (acc, entry) =>
        val key = entry.field[String]("key")
        val values = entry.get("values") match {
          case Some(s: String) => List(s)
          case _ => entry.field[List[String]]("values")
        }

        acc.get(key) match {
          case Some(existing) =>
            acc + (key -> (existing ++ values))

          case None =>
            acc + (key -> values)
        }
      }
    }

    // Documents are mostly a single language but it is possible to index them against multiple languages:
    //
    // text: {
    //   english: <contents>
    // }
    //
    // In this case the OCR field will contain completely different content (eg from a different Tesseract model) but the
    // text fields will contain the same values (eg extracted text from the PDF). So we just pick the first one we find.
    def multiLanguageField[T](name: String): T = {
      fields.field[FieldMap](name).values.head.asInstanceOf[T]
    }

    def optMultiLanguageField[T](name: String): Option[T] = {
      fields.optField[FieldMap](name).flatMap(_.values.headOption).map(_.asInstanceOf[T])
    }
  }

  implicit def HitToRichFieldMap(hit: Hit): RichFieldMap = {
    new RichFieldMap(hit.sourceAsMap)
  }

  implicit object SearchResultHitReader extends HitReader[SearchResult] {
    override def read(hit: Hit): Try[SearchResult] = {
      val metadata = hit.field[FieldMap]("metadata")
      val flag = hit.optField[String](flags)
      val created = hit.optField[Long](createdAt)

      val details = hit.field[String](`type`) match {
        case "email" => readEmailResult(metadata)
        case _ => readDocumentResult(metadata)
      }

      val highlights = hit match {
        case searchHit: SearchHit => HighlightFields.parseHit(searchHit)
        case _ => Seq.empty
      }

      val fieldWithMostHighlights = Try(
        highlights
          .groupBy(_.field)
          .maxBy(_._2.length)
          ._1
      ).toOption

      Success(SearchResult(hit.id, highlights, fieldWithMostHighlights, flag, created, details))
    }
  }

  implicit object IndexedResourceHitReader extends HitReader[IndexedResource] {
    override def read(hit: Hit): Try[IndexedResource] = {
      hit.field[String](`type`) match {
        case "blob" =>
          val resource = readDocument(hit.id, hit.sourceAsMap)
          val highlights = getHighlights(hit)

          Success(
            resource.copy(
              text = highlights.flatMap(highlightedText(_, text)).getOrElse(resource.text),
              ocr = highlightedOcr(highlights).orElse(resource.ocr)
            )
          )

        case "email" =>
          val resource = readEmail(hit.id, hit.sourceAsMap)
          Success(resource.copy(body = getHighlights(hit).flatMap(highlightedText(_, text)).getOrElse(resource.body)))

        case tpe =>
          Failure(new IllegalStateException(s"Resource exists in index but has an invalid type $tpe"))
      }
    }
  }

  implicit object EventHitReader extends HitReader[Event] {
    override def read(hit: Hit): Try[Event] = try {
      val rawEventType = hit.field[String](EventFields.eventType)
      val eventType = EventType.fromString(rawEventType)

      val timestamp = hit.longField(EventFields.timestamp)
      val description = hit.field[String](EventFields.description)

      val tags = hit.nestedField(EventFields.tagsField).map { case(k, v) => k -> v.head }

      Success(Event(eventType, timestamp, description, tags))
    } catch {
      case NonFatal(e) => Failure(e)
    }
  }

  implicit object IndexedBlobHitReader extends HitReader[IndexedBlob] {
    override def read(hit: Hit): Try[IndexedBlob] = try {
      val ingestion = hit.setField[String](IndexFields.ingestion)
      val collection = hit.setField[String](IndexFields.collection)
      Success(IndexedBlob(uri = hit.id, collections = collection, ingestions = ingestion))
    } catch {
      case NonFatal(e) => Failure(e)
    }
  }

  implicit object PageHitReader extends HitReader[Page] {
    override def read(hit: Hit): Try[Page] = try {
      val page = hit.longField(PagesFields.page)

      val highlightValues = highlightedPageOcr(getHighlights(hit))

      val notHighlightValues = hit.field[FieldMap](PagesFields.value).map { case(langKey, rawValue) =>
        Languages.getByKeyOrThrow(langKey) -> rawValue.asInstanceOf[String]
      }

      val dimensions = readDimensions(hit)

      // highlight values take precedent
      Success(Page(page, notHighlightValues ++ highlightValues, dimensions))
    } catch {
      case NonFatal(e) => Failure(e)
    }

    def readDimensions(hit: Hit): PageDimensions = {
      val width = hit.doubleField(s"${PagesFields.dimensions}.${PagesFields.width}")
      val height = hit.doubleField(s"${PagesFields.dimensions}.${PagesFields.height}")
      val top = hit.doubleField(s"${PagesFields.dimensions}.${PagesFields.top}")
      val bottom = hit.doubleField(s"${PagesFields.dimensions}.${PagesFields.bottom}")

      PageDimensions(width, height, top, bottom)
    }
  }

  private def readFileUris(fields: FieldMap): List[String] = {
    // Each item in the array is a multi-language value (eg { english: "test", portuguese: "test" })
    fields.listField[FieldMap](metadata.fileUris).map(_.values.head.asInstanceOf[String])
  }

  private def readEmailResult(fields: FieldMap): EmailResultDetails = {
    val from = fields.optField(metadata.fromField).map(readRecipient).getOrElse(Recipient.unknown)
    val subject = fields.optMultiLanguageField[String](metadata.subject).getOrElse("<Unknown Subject>")
    val attachmentCount = fields.optField[Int](metadata.attachmentCount).getOrElse(0)

    EmailResultDetails(from, subject, attachmentCount)
  }

  private def readDocumentResult(fields: FieldMap): DocumentResultDetails = {
    val paths = readFileUris(fields)
    val mimeTypes = fields.listField[String](metadata.mimeTypes)
    val fileSize = fields.optLongField(metadata.fileSize)

    DocumentResultDetails(mimeTypes, paths, fileSize)
  }

  private def readEmail(id: String, fields: FieldMap): Email = {
    val metadataMap = fields.field[FieldMap](metadataField)

    Email(
      uri = Uri(id),
      body = fields.multiLanguageField[String](text),

      from = metadataMap.optField[FieldMap](metadata.fromField).map(readRecipient),
      recipients = metadataMap.optField[List[FieldMap]](metadata.recipientsField).getOrElse(Nil).map(readRecipient),

      sentAt          = metadataMap.optField[String](metadata.sentAt),
      sensitivity     = metadataMap.optEnumField(metadata.sensitivity, Sensitivity),
      priority        = metadataMap.optField[String](metadata.priority),
      subject         = metadataMap.optMultiLanguageField(metadata.subject).getOrElse("<Unknown Subject>"),
      inReplyTo       = metadataMap.listField[String](metadata.inReplyTo),
      references      = metadataMap.listField[String](metadata.references),
      html            = metadataMap.optMultiLanguageField[String](metadata.html),
      attachmentCount = metadataMap.optField[Int](metadata.attachmentCount).getOrElse(0),
      metadata        = readMetadata(fields),
      flag            = fields.optField[String](flags)
    )
  }

  private def readDocument(id: String, fields: FieldMap): Document = {
    val metadataMap = fields.field[FieldMap](metadataField)

    Document(
      uri = Uri(id),
      text = fields.optMultiLanguageField(text).getOrElse(""),
      ocr = readOcr(fields),
      enrichedMetadata = readEnrichedMetadata(fields),
      flag = fields.optField[String](flags),
      extracted = fields.optField[Boolean](extracted).getOrElse(false),
      mimeTypes = metadataMap.setField[String](metadata.mimeTypes),
      fileUris  = readFileUris(metadataMap).toSet,
      fileSize  = metadataMap.optLongField(metadata.fileSize).getOrElse(0L),
      metadata = readMetadata(fields)
    )
  }

  private def readRecipient(fields: FieldMap): Recipient = Recipient(
    fields.optMultiLanguageField(metadata.recipients.name),
    fields.field(metadata.recipients.address)
  )

  private def readMetadata(fields: FieldMap): Map[String, Seq[String]] = {
    fields.optField[FieldMap](metadataField).map(_.nestedField(metadata.extractedMetadataField)).getOrElse(Map.empty)
  }

  private def readOcr(fields: FieldMap): Option[Map[String, String]] = {
    fields.optField[FieldMap](ocr).map { languages =>
      languages.view.mapValues(_.asInstanceOf[String]).toMap
    }
  }

  private def readEnrichedMetadata(fields: FieldMap): Option[EnrichedMetadata] = {
    val maybeMetadata = fields.optField[FieldMap](metadataField)
      .flatMap(_.optField[FieldMap](metadata.enrichedMetadataField))

    maybeMetadata.map { map =>
      EnrichedMetadata(
        map.optField[String](metadata.enrichedMetadata.title),
        map.optField[String](metadata.enrichedMetadata.author),
        map.optField[Long](metadata.enrichedMetadata.createdAt),
        map.optField[Long](metadata.enrichedMetadata.lastModified),
        map.optField[String](metadata.enrichedMetadata.createdWith),
        map.optField[Int](metadata.enrichedMetadata.pageCount),
        map.optField[Int](metadata.enrichedMetadata.wordCount)
      )
    }
  }

  private def getHighlights(hit: Hit): Option[Map[String, Seq[String]]] = hit match {
    case searchHit: SearchHit => Some(Option(searchHit.highlight).getOrElse(Map.empty))
    case _ => None
  }

  private def highlightedText(highlights: Map[String, Seq[String]], fieldName: String): Option[String] = {
    highlights.collectFirst {
      case (key, value :: _) if key.startsWith(fieldName) && value != "" => value
    }
  }

  private def highlightedOcr(maybeHighlights: Option[Map[String, Seq[String]]]): Option[Map[String, String]] = {
    maybeHighlights match {
      case Some(highlights) if highlights.nonEmpty =>
        val prefix = IndexFields.ocr + "."

        Some(highlights.collect {
          case (key, values) if key.startsWith(IndexFields.ocr) && values.nonEmpty =>
            key.substring(prefix.length) -> values.head
        })

      case _ =>
        None
    }
  }

  private def highlightedPageOcr(maybeHighlights: Option[Map[String, Seq[String]]]): Map[Language, String] = {
    val highlights = maybeHighlights.getOrElse(Map.empty)

    // We only expect a single highlight in each entry as we ask ES to highlight the whole document in the query
    // ES will return "value.english" as the field name
    highlights.collect { case(fieldName, highlight :: _) if fieldName.startsWith(PagesFields.value) =>
      val langKey = fieldName.substring(PagesFields.value.length + 1)
      val lang = Languages.getByKeyOrThrow(langKey)

      lang -> highlight
    }
  }
}
