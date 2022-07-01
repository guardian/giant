package model.index

import model.Language
import model.frontend.HighlightableText
import play.api.libs.json.{Format, JsArray, JsNull, JsNumber, JsString, JsValue, Json, Writes}

case class PagesSummary(numberOfPages: Long, height: Double)
object PagesSummary {
  implicit val format: Format[PagesSummary] = Json.format[PagesSummary]
}

case class PageDimensions(width: Double, height: Double, top: Double, bottom: Double)
object PageDimensions {
  implicit val format: Format[PageDimensions] = Json.format[PageDimensions]

  val A4_PORTRAIT = PageDimensions(595, 842, 0, 842)
}

case class HighlightSpan(x: Double, y: Double, width: Double, height: Double, rotation: Double)

sealed abstract class PageHighlight {
  def id: String
  def index: Int
  def spans: List[HighlightSpan]
}
// TODO: these are identical... why do we need them?
case class SearchHighlight(id: String, index: Int, spans: List[HighlightSpan]) extends PageHighlight
case class FindHighlight(id: String, index: Int, spans: List[HighlightSpan]) extends PageHighlight
// Other types of highlight might include comments or Ctrl-F searches

object PageHighlight {
  implicit val writes: Writes[PageHighlight] = {
    case h: SearchHighlight => Json.obj(
      "type" -> JsString("SearchHighlight"),
      "id" -> JsString(h.id),
      "index" -> JsNumber(h.index),
      "data" -> JsArray(h.spans.map  { s =>
        Json.obj(
          "x" -> JsNumber(s.x),
          "y" -> JsNumber(s.y),
          "width" -> JsNumber(s.width),
          "height" -> JsNumber(s.height),
          "rotation" -> JsNumber(s.rotation),
        )
      })
    )
    case h: FindHighlight => Json.obj(
      "type" -> JsString("FindHighlight"),
      "id" -> JsString(h.id),
      "index" -> JsNumber(h.index),
      "data" -> JsArray(h.spans.map  { s =>
        Json.obj(
          "x" -> JsNumber(s.x),
          "y" -> JsNumber(s.y),
          "width" -> JsNumber(s.width),
          "height" -> JsNumber(s.height),
          "rotation" -> JsNumber(s.rotation),
        )
      })
    )
  }
}

case class HighlightForSearchNavigation(
  pageNumber: Long,
  highlightNumber: Long,
  id: String,
  firstSpan: Option[HighlightSpan]
)
object HighlightForSearchNavigation {
  def fromPageHighlight(pageNumber: Long, highlightNumber: Long, pageHighlight: PageHighlight) =
    HighlightForSearchNavigation(pageNumber, highlightNumber, pageHighlight.id, pageHighlight.spans.headOption)

  implicit val writes: Writes[HighlightForSearchNavigation] = { h =>
    Json.obj(
      "pageNumber" -> JsNumber(h.pageNumber),
      "highlightNumber" -> JsNumber(h.highlightNumber),
      "id" -> JsString(h.id),
      "firstSpan" -> (h.firstSpan match {
        case Some(s) => Json.obj(
          "x" -> JsNumber(s.x),
          "y" -> JsNumber(s.y),
          "width" -> JsNumber(s.width),
          "height" -> JsNumber(s.height),
          "rotation" -> JsNumber(s.rotation),
        )
        case None => JsNull
      })
    )
  }
}

case class Page(page: Long, value: Map[Language, String], dimensions: PageDimensions)
case class PageWithFind(page: Long, value: Map[Language, String], highlightedText: Option[Map[Language, String]], dimensions: PageDimensions)
case class FrontendPage(page: Long, currentLanguage: Language, allLanguages: Set[Language], dimensions: PageDimensions, highlights: List[PageHighlight])

object FrontendPage {
  implicit val writes: Writes[FrontendPage] = Json.writes[FrontendPage]
}

case class PageFetchViewport(top: Double, bottom: Double)

case class PageResult(summary: PagesSummary, pages: List[Page])
case class FrontendPageResult(summary: PagesSummary, pages: List[FrontendPage])

object FrontendPageResult {
  implicit val format: Writes[FrontendPageResult] = Json.writes[FrontendPageResult]
}
