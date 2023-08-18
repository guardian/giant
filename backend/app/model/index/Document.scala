package model.index

import extraction.EnrichedMetadata
import model.Uri
import play.api.libs.json._

// A document a blob in the index with all the associated extracted data.
case class Document(uri: Uri,
                    extracted: Boolean,
                    mimeTypes: Set[String],
                    fileUris: Set[String],
                    text: String,
                    ocr: Option[Map[String, String]],
                    transcript: Option[Map[String, String]],
                    metadata: Map[String, Seq[String]],
                    enrichedMetadata: Option[EnrichedMetadata],
                    flag: Option[String],
                    fileSize: Long) extends IndexedResource

object Document {
  implicit val documentFormat = Json.format[Document]
}
