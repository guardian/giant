package model.index

import play.api.libs.json.{Format, Json}

case class TableRow(sheetName: Option[String], rowIndex: Int, cells: Map[String, String])
object TableRow {
  implicit val tableRowFormat: Format[TableRow] = Json.format[TableRow]
}
