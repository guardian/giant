package utils

import java.text.SimpleDateFormat
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

import scala.util.Try

object DateTimeUtils {
  def isoToEpochMillis(text: String): Option[Long] =
    Try(new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX").parse(text).getTime).toOption

  /**
    * Hey future developer! If this method looks really bad, that's because it is!
    * The old sk00l Java libraries will use the local timezone when parsing, even though the
    * date hasn't got one.
    *
    * Only use this method if you really need to. The original use case was general sorting
    * of results pages by sentAt time. The actual UI will display the real sentAt string
    * (without a timezone).
    */
  def isoMissingTimeZoneToMillis(text: String): Option[Long] =
    Try(new SimpleDateFormat("yyyy-MM-dd'T'HH:mm").parse(text).getTime).toOption

  def rfc1123ToEpochMillis(text: String): Option[Long] =
    Try(new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz").parse(text).getTime).toOption

  def rfc1123ToIsoDateString(text: String): Option[String] =
    Try(DateTimeFormatter.ISO_DATE_TIME.format(DateTimeFormatter.RFC_1123_DATE_TIME.parse(text))).toOption
}
