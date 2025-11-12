package model

import java.time.format.DateTimeFormatter
import java.time.{LocalDateTime, OffsetDateTime, ZoneOffset}
import play.api.libs.json.{Json, Writes}

import scala.util.Try

/**
  * A helper for notifying users of the quality of a date time.
  */
case class ExtractedDateTime(time: OffsetDateTime, knownTimezone: Boolean)

object ExtractedDateTime {
  def fromIsoString(text: String): Option[ExtractedDateTime] = {
    Try {
      val offset = OffsetDateTime.parse(text, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
      ExtractedDateTime(offset, knownTimezone =  true)
    }.recover { case _ =>
      val local = LocalDateTime.parse(text, DateTimeFormatter.ISO_DATE_TIME)
      val offset = OffsetDateTime.of(local, ZoneOffset.UTC)
      ExtractedDateTime(offset, knownTimezone = false)
    }.toOption
  }

  implicit val writes: Writes[ExtractedDateTime] = Json.writes[ExtractedDateTime]
}

