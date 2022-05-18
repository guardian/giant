package model.frontend

import enumeratum.EnumEntry.Snakecase
import enumeratum.{EnumEntry, PlayEnum}
import play.api.libs.json.{Format, Json}

import scala.annotation.tailrec

sealed trait HighlightRangeType extends EnumEntry with Snakecase
object HighlightRangeType extends PlayEnum[HighlightRangeType] {
  case object SearchResult extends HighlightRangeType
  // Comment highlights are wired up on the client

  override val values = findValues
}

case class HighlightRange(startCharacter: Int, endCharacter: Int)
object HighlightRange {
  implicit val format: Format[HighlightRange] = Json.format[HighlightRange]
}

case class TextHighlight(id: String, `type`: HighlightRangeType, range: HighlightRange)
object TextHighlight {
  implicit val format: Format[TextHighlight] = Json.format[TextHighlight]
}

case class HighlightableText(
  contents: String,
  highlights: List[TextHighlight]
)

object HighlightableText {
  implicit val highlightableTextFormat = Json.format[HighlightableText]

  def searchHighlightId(ix: Int, page: Option[Long], isFind: Boolean): String = {
    val pageIdPrefix = page.map { p => s"page-$p-" }.getOrElse("")
    val findPrefix = if (isFind) "find-" else ""
    findPrefix + pageIdPrefix + s"search-result-$ix"
  }

  @tailrec
  private def _fromString(s: String, page: Option[Long], acc: HighlightableText, isFind: Boolean): HighlightableText = {
    val startOfTag = s.indexOf("<result-highlight>")
    val endOfTag = s.indexOf("</result-highlight>")

    if(startOfTag == -1) {
      HighlightableText(acc.contents + s, acc.highlights)
    } else {
      val beforeSlice = s.slice(0, startOfTag)
      val inSlice = s.slice(startOfTag + "<result-highlight>".length, endOfTag)

      val highlight = TextHighlight(
        id = searchHighlightId(acc.highlights.length, page, isFind),
        HighlightRangeType.SearchResult,
        HighlightRange(
          startOfTag + acc.contents.length,
          (endOfTag - "<result-highlight>".length) + acc.contents.length
        )
      )

      val newText = acc.contents + beforeSlice + inSlice
      val textRemaining = s.slice(endOfTag + "</result-highlight>".length, s.length)

      _fromString(textRemaining, page, HighlightableText(newText, acc.highlights :+ highlight), isFind)
    }
  }

  def fromString(s: String, page: Option[Long], isFind: Boolean = false): HighlightableText = {
    _fromString(s, page, HighlightableText("", List.empty), isFind)
  }
}
