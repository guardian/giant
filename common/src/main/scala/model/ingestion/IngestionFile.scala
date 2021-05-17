package model.ingestion

import java.io.InputStream
import java.net.URI
import java.nio.file.attribute.FileTime
import java.nio.file.{Files, Path, Paths}
import java.time.Instant

import model.Uri
import play.api.libs.json.{Format, JsString, JsValue, Json}

// Metadata describing a file within an ingestion
case class IngestionFile(uri: Uri,
                         parentUri: Uri,
                         size: Long,
                         lastAccessTime: Option[FileTime],
                         lastModifiedTime: Option[FileTime],
                         creationTime: Option[FileTime],
                         isRegularFile: Boolean)

object IngestionFile {
  def apply(path: Path, uri: Uri, parentUri: Uri, attr: java.util.Map[String, AnyRef], temporary: Boolean = false): IngestionFile = {
    IngestionFile(
      uri = uri,
      parentUri = parentUri,
      size = attr.get("size").asInstanceOf[Long],
      lastAccessTime = Some(attr.get("lastAccessTime").asInstanceOf[FileTime]),
      lastModifiedTime = Some(attr.get("lastModifiedTime").asInstanceOf[FileTime]),
      creationTime = Some(attr.get("creationTime").asInstanceOf[FileTime]),
      isRegularFile = attr.get("isRegularFile").asInstanceOf[Boolean],
    )
  }

  implicit val fileTimeFormat = new Format[FileTime] {
    override def reads(json: JsValue) = json.validate[String].map(s => FileTime.from(Instant.parse(s)))
    override def writes(o: FileTime) = JsString(o.toInstant.toString)
  }

  implicit val pathFormat = new Format[Path] {
    override def reads(json: JsValue) = json.validate[String].map(s => Paths.get(new URI(s)))
    override def writes(o: Path) = JsString(o.toAbsolutePath.toUri.toString)
  }

  implicit val format = Json.format[IngestionFile]
}

