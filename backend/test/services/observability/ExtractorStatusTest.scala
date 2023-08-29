package services.observability

import org.joda.time.DateTime
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers
import play.api.libs.json.Json

class ExtractorStatusTest extends  AnyFreeSpec with Matchers {

  def getDate(minutes: Int, seconds: Int) = new DateTime(2023, 1, 1, 1, minutes, seconds, 200)
  def epochString(date: DateTime): String = {
    (date.getMillis / 1000.0).toString
  }

  "parseDbStatusEvents" - {

    "correctly parses status event arrays" in {
      val extractors = Array("OlmEmailExtractor", "ZipExtractor")
      val date1 = getDate(1, 2)
      val date2 = getDate(3, 4)
      val olmEventTimes = Array(epochString(date1), epochString(date2)).mkString(",")
      val zipEventTimes = Array(epochString(date1), epochString(date2)).mkString(",")

      val olmStatuses = "Success,Failure"
      val zipStatuses = "null,Failure"

      val parsedStatus = ExtractorStatus.parseDbStatusEvents(extractors, Array(olmEventTimes, zipEventTimes), Array(olmStatuses, zipStatuses))
      
      val expected = List(
        ExtractorStatus(
          ExtractorType.OlmEmailExtractor, List(
            ExtractorStatusUpdate(Some(date1), Some(EventStatus.Success)),
            ExtractorStatusUpdate(Some(date2), Some(EventStatus.Failure)))
        ),
        ExtractorStatus(
          ExtractorType.ZipExtractor, List(
            ExtractorStatusUpdate(Some(date1), None),
            ExtractorStatusUpdate(Some(date2), Some(EventStatus.Failure))
          )
        )
      )
      assert(Json.stringify(Json.toJson(expected)) == Json.stringify(Json.toJson(parsedStatus)))

    }
  }

}
