package utils.controller

import play.api.mvc.Session
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext
import scala.concurrent.duration._
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class DownloadHelperTest extends AnyFunSuite with Matchers with DownloadHelper {
  override def checkResource(username: String, url: String)(implicit ec: ExecutionContext): Attempt[Unit] = Attempt.Right(())
  override def downloadExpiryPeriod: FiniteDuration = 1.minute

  test("append key to session") {
    val now = System.currentTimeMillis()

    val result = authoriseDownload("test", filename = None, now, Session())
    val session = result.newSession.get

    val expected = (now + downloadExpiryPeriod.toMillis).toString
    session.data must be(Map(makeSessionKey("test") -> expected))
  }

  test("allow if token within expiry period") {
    val now = System.currentTimeMillis()
    val expiry = now + (downloadExpiryPeriod / 2).toMillis

    val before = Session(Map(makeSessionKey("test") -> expiry.toString))
    val (authorised, after) = authorisedToDownload("test", before, now)

    authorised must contain(true)
    before must be(after)
  }

  test("disallow if token has expired and remove token from session") {
    val now = System.currentTimeMillis()
    val expiry = now - (downloadExpiryPeriod / 2).toMillis

    val before = Session(Map(makeSessionKey("test") -> expiry.toString))
    val (authorised, after) = authorisedToDownload("test", before, now)

    authorised must contain(false)
    after.data mustBe empty
  }

  test("disallow if token missing") {
    val now = System.currentTimeMillis()

    val before = Session()
    val (authorised, after) = authorisedToDownload("test", before, now)

    authorised mustBe empty
    after.data mustBe empty
  }
}
