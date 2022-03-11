package model.index

import model.Language
import model.frontend.HighlightableText
import play.api.libs.json.{Format, JsNumber, JsString, JsValue, Json, Writes, JsArray}

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

sealed abstract class PageHighlight { def id: String }
case class SearchResultPageHighlight(id: String, spans: List[HighlightSpan]) extends PageHighlight
case class ImpromptuSearchPageHighlight(id: String, spans: List[HighlightSpan]) extends PageHighlight
// Other types of highlight might include comments or Ctrl-F searches

object PageHighlight {
  implicit val writes: Writes[PageHighlight] = {
    case h: SearchResultPageHighlight => Json.obj(
      "type" -> JsString("SearchResultPageHighlight"),
      "id" -> JsString(h.id),
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
    case h: ImpromptuSearchPageHighlight => Json.obj(
      "type" -> JsString("ImpromptuSearchPageHighlight"),
      "id" -> JsString(h.id),
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

case class Page(page: Long, value: Map[Language, String], dimensions: PageDimensions)
case class PageWithImpromptuSearch(page: Long, value: Map[Language, String], impromptuSearchValue: Option[Map[Language, String]], dimensions: PageDimensions)
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
