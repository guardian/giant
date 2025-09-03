package model.frontend

import extraction.EnrichedMetadata
import model._
import model.annotations.Comment
import model.index.{Document, IndexedResource}
import org.neo4j.driver.v1.Value
import play.api.libs.json._
import services.previewing.{PreviewService, PreviewStatus}

import scala.jdk.CollectionConverters._

case class RelatedResource(uri: String, `type`: String, display: Option[String], isExpandable: Boolean)

object RelatedResource {
  implicit val relatedResourceFormat = Json.format[RelatedResource]

  def fromNeo4jValue(v: Value) = RelatedResource(
    v.get("uri").asString(),
    BasicResource.getLabelFromValue(v),
    v.get("display").optionally(_.asString()),
    v.get("isExpandable").optionally(_.asBoolean()).getOrElse(false)
  )
}

trait Resource {
  def uri: String
  def display: Option[String]
  def `type`: String
  def isBasic: Boolean
  def isExpandable: Boolean
  def previewStatus: PreviewStatus
  def parents: List[RelatedResource]
  def children: List[RelatedResource]
}

object Resource {
  private val emailResourceFormat = Json.format[EmailResource]
  private val documentResourceFormat = Json.format[DocumentResource]

  def mergeResources(indexable: IndexedResource, basic: BasicResource, comments: List[Comment]): Resource = indexable match {
    case d: Document => DocumentResource.fromDocument(d, basic, comments: List[Comment])
    case e: Email => EmailResource.fromEmail(e, basic, comments: List[Comment])
    case _ => basic
  }

  implicit val format = new Format[Resource] {
    override def writes(resource: Resource): JsValue = resource match {
      case r: BasicResource => BasicResource.format.writes(r)
      case r: EmailResource => emailResourceFormat.writes(r)
      case r: DocumentResource => documentResourceFormat.writes(r)
    }

    override def reads(json: JsValue): JsResult[Resource] = (json \ "isBasic").get match {
      case JsTrue => BasicResource.format.reads(json)
      case _ => (json \ "type").get match {
        case JsString("email") => emailResourceFormat.reads(json)
        case JsString("document") => documentResourceFormat.reads(json)
        case JsString(other) => JsError(s"Unexpected type value: '$other'")
        case _ => JsError("Unexpected value for resource type")
      }
    }
  }
}

// Basic resource is used when you don't want to have all the information about a particular resource - for example when you're
// exploring a file tree you don't want to pull in all the Blob information
case class BasicResource(
    uri: String,
    display: Option[String],
    `type`: String,
    parents: List[RelatedResource] = Nil,
    children: List[RelatedResource] = Nil,
    isBasic: Boolean = true,
    isExpandable: Boolean,
    previewStatus: PreviewStatus = PreviewStatus.Disabled
) extends Resource


object BasicResource {
  implicit val format: Format[BasicResource] = Json.format[BasicResource]

  def getLabelFromValue(v: Value): String = {
    v.asNode().labels().asScala.toList.filterNot(_ == "Resource").head.toLowerCase
  }

  def fromNeo4jValues(resource: Value, parentValues: List[Value], childValues: List[Value]): BasicResource = {

    BasicResource(
      uri = resource.get("uri").asString(),
      display = resource.get("display").optionally(_.asString()),
      `type` = getLabelFromValue(resource),
      isExpandable = resource.get("isExpandable").optionally(_.asBoolean()).getOrElse(false),
        parents = parentValues.map(p => RelatedResource.fromNeo4jValue(p)),
      children = childValues.map(c => RelatedResource.fromNeo4jValue(c))
    )
  }
}

case class EmailResource(
  uri: String,
  display: Option[String],
  parents: List[RelatedResource],
  children: List[RelatedResource],
  from: Option[Recipient],
  recipients: List[Recipient],
  sentAt: Option[String],
  sensitivity: Option[Sensitivity],
  priority: Option[String],
  subject: String,
  text: HighlightableText,
  inReplyTo: List[String],
  references: List[String],
  previewStatus: PreviewStatus,
  flag: Option[String],
  extracted: Boolean = true,
  `type`: String = "email",
  isBasic: Boolean = false,
  isExpandable: Boolean,
  comments: List[Comment]
) extends Resource

object EmailResource {
  def fromEmail(email: Email, basic: BasicResource, comments: List[Comment]): EmailResource = EmailResource(
    uri = email.uri.value,
    display = Some(email.subject),
    parents = basic.parents,
    children = basic.children,
    from = email.from,
    recipients = email.recipients,
    sentAt = email.sentAt,
    sensitivity = email.sensitivity,
    priority = email.priority,
    subject = email.subject,
    text = HighlightableText.fromString(email.body, page = None),
    inReplyTo = email.inReplyTo,
    references = email.references,
    previewStatus = if (email.html.isDefined) PreviewStatus.PdfGenerated else PreviewStatus.Disabled,
    flag = email.flag,
    isExpandable = basic.isExpandable,
    comments = comments
  )
}

case class DocumentResource private (
                                      uri: String,
                                      display: Option[String],
                                      parents: List[RelatedResource],
                                      children: List[RelatedResource],
                                      text: HighlightableText,
                                      ocr: Option[Map[String, HighlightableText]],
                                      transcript: Option[Map[String, HighlightableText]],
                                      vttTranscript: Option[Map[String, HighlightableText]],
                                      metadata: Map[String, Seq[String]],
                                      enrichedMetadata: Option[EnrichedMetadata],
                                      previewStatus: PreviewStatus,
                                      flag: Option[String],
                                      extracted: Boolean,
                                      fileSize: Long,
                                      mimeTypes: Set[String],
                                      `type`: String = "blob",
                                      isBasic: Boolean = false,
                                      isExpandable: Boolean,
                                      comments: List[Comment]
) extends Resource

object DocumentResource {
  def fromDocument(document: Document, basic: BasicResource, comments: List[Comment]): DocumentResource = {
    DocumentResource(
      uri = document.uri.value,
      display = None, // Documents shouldn't be shown directly in the resource browser so don't need display text
      parents = basic.parents,
      children = basic.children,
      text = HighlightableText.fromString(document.text, page = None),
      ocr = document.ocr.map(ocrMap => ocrMap.view.mapValues { v => HighlightableText.fromString(v, page = None) }.toMap),
      transcript = document.transcript.map(transcriptMap => transcriptMap.view.mapValues { v => HighlightableText.fromString(v, page = None) }.toMap),
      vttTranscript = document.vttTranscript.map(vttTranscriptMap => vttTranscriptMap.view.mapValues { v => HighlightableText.fromString(v, page = None) }.toMap),
      metadata = document.metadata,
      enrichedMetadata = document.enrichedMetadata,
      previewStatus = PreviewService.previewStatus(document.mimeTypes),
      flag = document.flag,
      extracted = document.extracted,
      fileSize = document.fileSize,
      mimeTypes = document.mimeTypes,
      isExpandable = basic.isExpandable,
      comments = comments
    )
  }
}
