package utils

import java.time.{Instant, OffsetDateTime, ZoneId}

object Time {
  implicit class EpochLong(millis: Long) {
    def millisToDateTime(zoneId: ZoneId = ZoneId.systemDefault()): OffsetDateTime =
      OffsetDateTime.ofInstant(Instant.ofEpochMilli(millis), zoneId)
  }
}
