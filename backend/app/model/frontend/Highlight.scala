package model.frontend

import play.api.libs.json.{Format, Json}

case class Highlight(field: String, display: String, highlight: String)

object Highlight {
  implicit val highlightFormat: Format[Highlight] = Json.format[Highlight]
}
