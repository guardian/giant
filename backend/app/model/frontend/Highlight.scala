package model.frontend

import play.api.libs.json.Json

case class Highlight(field: String, display: String, highlight: String)

object Highlight {
  implicit val highlightFormat = Json.format[Highlight]
}
