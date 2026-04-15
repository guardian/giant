package com.gu.pfi.cli

import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers
import utils.attempt.AttemptAwait._

import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Await
import scala.concurrent.duration.Duration

class CommandValidatorTest extends AnyFunSuite with Matchers {

  test("validateIngestionUri accepts valid format") {
    CommandValidator.validateIngestionUri("myCollection/myIngestion").await()
  }

  test("validateIngestionUri rejects missing slash") {
    val either = Await.result(CommandValidator.validateIngestionUri("noSlash").asFuture, Duration.Inf)
    either.isLeft must be(true)
  }

  test("validateIngestionUri rejects empty parts") {
    val either = Await.result(CommandValidator.validateIngestionUri("/ingestion").asFuture, Duration.Inf)
    either.isLeft must be(true)
  }

  test("validateIngestionUri rejects too many parts") {
    val either = Await.result(CommandValidator.validateIngestionUri("a/b/c").asFuture, Duration.Inf)
    either.isLeft must be(true)
  }
}
