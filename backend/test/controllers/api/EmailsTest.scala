package controllers.api

import java.time.{OffsetDateTime, ZoneOffset}

import model.ExtractedDateTime
import model.frontend.email._
import org.scalatest.concurrent.ScalaFutures
import play.api.mvc.Results
import test.AttemptValues
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

class EmailsTest extends AnyFreeSpec with Matchers with Results with ScalaFutures with AttemptValues {
  "Email thread processing" - {
    def emailNeighbour(uri: String, date: Option[OffsetDateTime], neighbours: String*) = {
      val extractionDate = date.map(ExtractedDateTime(_, true))
      EmailNeighbours(
        Email(
          uri,
          date.isDefined,
          None,
          date.map(d => EmailMetadata(Some("Irrelevant"), Some("irellevant@example.com"), Some("Mr. Irellevant"), extractionDate))
        ),
        neighbours.map(n => Neighbour("IRRELEVANT", n)).toSet
      )
    }

    def aDate(hour: Int, minute: Int) = Some(OffsetDateTime.of(2018, 2, 26, hour, minute, 0, 0, ZoneOffset.UTC))

    val thread: List[EmailNeighbours] = List(
      emailNeighbour("A", None),
      emailNeighbour("B", None),
      emailNeighbour("C", aDate(13, 6), "A", "B"),
      emailNeighbour("D", None),
      emailNeighbour("E", aDate(13, 28), "D", "C", "B", "L"),
      emailNeighbour("F", None),
      emailNeighbour("G", None),
      emailNeighbour("H", None),
      emailNeighbour("I", aDate(14,56), "E", "F", "G", "H", "M"),
      emailNeighbour("J", aDate(15,6)),
      emailNeighbour("K", None)
    )

    val randomThread = scala.util.Random.shuffle(thread)

    "sort should correctly order thread emails" in {
      Emails.sort(randomThread) shouldBe thread
    }

    "missingNodes should correctly find the missing nodes" in {
      Emails.missingNodes(randomThread) shouldBe Set("L", "M")
    }
  }
}
