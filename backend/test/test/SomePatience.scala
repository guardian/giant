package test

import org.scalatest.concurrent.PatienceConfiguration
import org.scalatest.time.{Millis, Seconds, Span}

trait SomePatience extends PatienceConfiguration {
  implicit override val patienceConfig = PatienceConfig(scaled(Span(5, Seconds)), scaled(Span(10, Millis)))
}
