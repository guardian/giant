package model.frontend

import play.api.libs.json._

object FilterNames {
  case class FilterName(display: String, key: String)

  val workspaces = FilterName("Workspaces", "workspace")
  val collections = FilterName("Datasets", "ingestion")
  val mimeTypes = FilterName("File Types", "mimeType")
}
case class FilterOption(value: String, display: String, explanation: Option[String] = None, suboptions: Option[List[FilterOption]] = None)

object FilterOption {
  implicit val filterOptionFormat = Json.format[FilterOption]
}

case class Filter(key: String, display: String, hideable: Boolean, options: List[FilterOption])

object Filter {
  implicit val filterFormat = Json.format[Filter]
}
