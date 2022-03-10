package model.index

import model.Language
import play.api.libs.json.{Json, Writes}

case class FrontendPage2(page: Long,
                        currentLanguage: Language,
                        allLanguages: Set[Language],
                        dimensions: PageDimensions,
                        highlights: List[PageHighlight],
                        impromptuHighlights: List[PageHighlight])

object FrontendPage2 {
  implicit val writes: Writes[FrontendPage] = Json.writes[FrontendPage]
}