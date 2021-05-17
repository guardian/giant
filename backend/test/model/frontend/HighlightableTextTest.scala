package model.frontend

import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class HighlightableTextTest extends AnyFunSuite with Matchers {
  test("extract highlights") {
    val input = "michael is <result-highlight>testing</result-highlight> and this has <result-highlight>no space</result-highlight>after but this <result-highlight>does have</result-highlight> space after"
    val output = HighlightableText.fromString(input, page = None)

    output.contents must be("michael is testing and this has no spaceafter but this does have space after")
    output.highlights.map(_.range) must contain only(
      HighlightRange(11, 18),
      HighlightRange(32, 40),
      HighlightRange(55, 64),
    )
  }

  test("handle no highlights") {
    val input = "michael is testing his stuff"
    val output = HighlightableText.fromString(input, page = None)

    output.contents must be("michael is testing his stuff")
    output.highlights mustBe empty
  }
}
