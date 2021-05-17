package model.index

import model.Language
import model.frontend.HighlightableText
import play.api.libs.json.{Format, JsNumber, JsString, JsValue, Json, Writes}

case class PagesSummary(numberOfPages: Long, height: Double)
object PagesSummary {
  implicit val format: Format[PagesSummary] = Json.format[PagesSummary]
}

case class PageDimensions(width: Double, height: Double, top: Double, bottom: Double)
object PageDimensions {
  implicit val format: Format[PageDimensions] = Json.format[PageDimensions]

  val A4_PORTRAIT = PageDimensions(595, 842, 0, 842)
}

sealed abstract class PageHighlight { def id: String }
case class SearchResultPageHighlight(id: String, x: Double, y: Double, width: Double, height: Double) extends PageHighlight

object PageHighlight {
  implicit val writes: Writes[PageHighlight] = {
    case h: SearchResultPageHighlight => Json.obj(
      "type" -> JsString("SearchResultPageHighlight"),
      "id" -> JsString(h.id),
      "data" -> Json.obj(
        "x" -> JsNumber(h.x),
        "y" -> JsNumber(h.y),
        "width" -> JsNumber(h.width),
        "height" -> JsNumber(h.height)
      )
    )
  }
}

case class Page(page: Long, value: Map[Language, String], dimensions: PageDimensions)
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
