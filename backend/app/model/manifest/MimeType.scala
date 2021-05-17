package model.manifest

import org.neo4j.driver.v1.Value
import play.api.libs.json.Json

case class MimeType(mimeType: String)

object MimeType {
  implicit val mimeTypeFormat = Json.format[MimeType]

  def fromNeo4jValue(mimeType: Value): MimeType = {
    MimeType(
      mimeType = mimeType.get("mimeType").asString()
    )
  }
}

case class MimeTypeCoverage(mimeType: MimeType, humanReadableMimeType: Option[String],
                            total: Long, todo: Long, done: Long, failed: Long)

object MimeTypeCoverage {
  implicit val mimeCoverageTypeFormat = Json.format[MimeTypeCoverage]
}
