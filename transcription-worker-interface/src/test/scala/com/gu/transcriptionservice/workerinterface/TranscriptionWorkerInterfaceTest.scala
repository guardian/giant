package com.gu.transcriptionservice.workerinterface

import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.should.Matchers
import play.api.libs.json._

/** Sanity checks for the generated codecs in TranscriptionWorkerInterface.scala.
  *
  * These are deliberately written against raw JSON rather than the case classes, so that they
  * assert the *wire format* stays as the transcription service expects it - in particular that the
  * discriminator (which is lifted out of the case class constructor) survives a round trip.
  */
class TranscriptionWorkerInterfaceTest extends AnyFunSuite with Matchers {

  private def roundTrip[A: Reads: Writes](json: JsValue): JsValue = {
    val parsed = json.validate[A] match {
      case JsSuccess(value, _) => value
      case JsError(errors)     => fail(s"Failed to parse: $errors")
    }
    Json.toJson(parsed)
  }

  private val transcriptionSuccess = Json.obj(
    "id" -> "abc",
    "userEmail" -> "someone@example.com",
    "status" -> "SUCCESS",
    "originalFilename" -> "interview.mp3",
    "languageCode" -> "en",
    "combinedOutputKey" -> "outputs/abc.json",
    "includesTranslation" -> false,
    "translationRequested" -> false
  )

  test("parses a transcription success into the right variant") {
    transcriptionSuccess.as[TranscriptionOutput] match {
      case output: TranscriptionOutputSuccess =>
        output.id shouldBe "abc"
        output.languageCode shouldBe OutputLanguageCode.En
        output.status shouldBe "SUCCESS"
        output.duration shouldBe None
      case other => fail(s"Expected TranscriptionOutputSuccess, got $other")
    }
  }

  test("round trips a transcription success, preserving the discriminator") {
    roundTrip[TranscriptionOutput](transcriptionSuccess) shouldBe transcriptionSuccess
  }

  test("round trips a media download failure") {
    val json = Json.obj(
      "id" -> "def",
      "userEmail" -> "someone@example.com",
      "status" -> "MEDIA_DOWNLOAD_FAILURE",
      "failureReason" -> "BOT_BLOCKED",
      "url" -> "https://example.com/video"
    )

    json.as[TranscriptionOutput] match {
      case output: MediaDownloadFailure => output.failureReason shouldBe FailureReason.BotBlocked
      case other                        => fail(s"Expected MediaDownloadFailure, got $other")
    }

    roundTrip[TranscriptionOutput](json) shouldBe json
  }

  test("round trips an LLM success") {
    val json = Json.obj(
      "id" -> "ghi",
      "userEmail" -> "someone@example.com",
      "status" -> "LLM_SUCCESS",
      "outputKey" -> "outputs/ghi.json"
    )

    roundTrip[TranscriptionOutput](json) shouldBe json
  }

  test("rejects an unknown status") {
    val json = Json.obj("id" -> "jkl", "userEmail" -> "x@example.com", "status" -> "SOMETHING_NEW")

    json.validate[TranscriptionOutput] shouldBe a[JsError]
  }

  test("rejects an unknown enum value") {
    val json = transcriptionSuccess ++ Json.obj("languageCode" -> "klingon")

    json.validate[TranscriptionOutput] shouldBe a[JsError]
  }

  test("round trips a worker job, deduplicating the shared combinedOutputUrl shape") {
    val json = Json.obj(
      "id" -> "mno",
      "originalFilename" -> "interview.mp3",
      "inputSignedUrl" -> "https://example.com/in",
      "sentTimestamp" -> "2026-09-04T00:00:00Z",
      "userEmail" -> "someone@example.com",
      "transcriptDestinationService" -> "Giant",
      "combinedOutputUrl" -> Json.obj("url" -> "https://example.com/out", "key" -> "outputs/mno.json"),
      "jobType" -> "transcribe",
      "languageCode" -> "auto",
      "translate" -> false,
      "diarize" -> true,
      "engine" -> "whisperx"
    )

    json.as[WorkerJob] match {
      case job: TranscriptionJob =>
        job.combinedOutputUrl shouldBe CombinedOutputUrl("https://example.com/out", "outputs/mno.json")
        job.engine shouldBe TranscriptionEngine.Whisperx
      case other => fail(s"Expected TranscriptionJob, got $other")
    }

    roundTrip[WorkerJob](json) shouldBe json
  }

  test("omits absent optional fields rather than writing nulls") {
    val written = Json.toJson[TranscriptionOutput](
      TranscriptionOutputSuccess(
        id = "abc",
        userEmail = "someone@example.com",
        originalFilename = "interview.mp3",
        languageCode = OutputLanguageCode.En,
        combinedOutputKey = "outputs/abc.json",
        duration = None,
        maybeEnqueuedAtEpochMillis = None,
        includesTranslation = false,
        translationRequested = false
      )
    )

    written.as[JsObject].keys should not contain "duration"
  }
}

