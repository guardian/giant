package utils

import java.time.{OffsetDateTime, ZoneOffset}

case class Epoch(seconds: Long) extends AnyVal {
  def millis = seconds * 1000
}

object Epoch {
  def now = Epoch(System.currentTimeMillis() / 1000L)
  def from(dt: OffsetDateTime): Epoch = Epoch(dt.toEpochSecond)
  def fromUtc(year: Int, month: Int, day: Int, hour: Int = 0, minute: Int = 0, second: Int = 0) =
    Epoch.from(OffsetDateTime.of(2019, 2, 14, 10, 0, 0, 0, ZoneOffset.UTC))
}
