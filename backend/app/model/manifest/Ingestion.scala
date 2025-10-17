package model.manifest

import java.time.OffsetDateTime
import model._
import org.neo4j.driver.v1.Value
import play.api.libs.json.{Format, Json}
import utils.Time._

import scala.jdk.CollectionConverters._

case class Ingestion(display: String,
                     uri: String,
                     startTime: OffsetDateTime,
                     endTime: Option[OffsetDateTime],
                     path: Option[String],
                     failureMessage: Option[String],
                     languages: List[Language],
                     fixed: Boolean,
                     default: Boolean
                    )

object Ingestion {
  implicit val ingestionFormat: Format[Ingestion] = Json.format[Ingestion]

  def fromNeo4jValue(ingestion: Value): Ingestion = {
    Ingestion(
      uri = ingestion.get("uri").asString(),
      display = ingestion.get("display").asString(),
      startTime = ingestion.get("startTime").asLong().millisToDateTime(),
      endTime = ingestion.get("endTime").optionally(_.asLong.millisToDateTime()),
      path = ingestion.get("path").optionally(_.asString()),
      failureMessage = ingestion.get("failureMessage").optionally(_.asString),
      languages = getLanguages(ingestion),
      // Default safe so ingestions created before this flag existed cannot have more files added
      fixed = ingestion.get("fixed").optionally(_.asBoolean()).getOrElse(true),
      default = ingestion.get("default").optionally(_.asBoolean()).getOrElse(false)
    )
  }

  private def getLanguages(ingestion: Value): List[Language] = {
    if(!ingestion.get("languages").isNull) {
      ingestion.get("languages").asList(k => k.asString).asScala.toList.flatMap(Languages.getByKey)
    } else {
      List.empty
    }
  }
}
