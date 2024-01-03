package services.table

import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.fields.ObjectField
import model.Uri
import model.index.TableRow
import services.ElasticsearchSyntax
import utils.Logging
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

trait Tables {
  def setup(): Attempt[Tables]
  def addDocumentRows(uri: Uri, rows: Seq[TableRow]): Attempt[Unit]
}

class ElasticsearchTable(override val client: ElasticClient, tableIndexName: String)(implicit ec: ExecutionContext) extends Tables with Logging with ElasticsearchSyntax {

  override def setup(): Attempt[Tables] =
    createIndexIfNotAlreadyExists(tableIndexName,
      properties(
        textField(TableRowFields.tableId),
        intField(TableRowFields.rowIndex),
        textField(TableRowFields.sheetName),
        ObjectField(TableRowFields.cellsField, properties = Seq(
          textField(TableRowFields.cells.key),
          textField(TableRowFields.cells.value)
        ))
      )
    ).map { _ => this }

  override def addDocumentRows(uri: Uri, rows: Seq[TableRow]): Attempt[Unit] = {
    val ops = rows.map { row =>
      indexInto(tableIndexName).fields(Map(
        TableRowFields.tableId -> uri.value,
        TableRowFields.rowIndex -> row.rowIndex,
        TableRowFields.cellsField -> row.cells.map( cell =>
          Map(
            TableRowFields.cells.key -> cell._1,
            TableRowFields.cells.value -> cell._2
          )
        )
      ) ++ row.sheetName.map(TableRowFields.sheetName -> _))
    }

    executeBulk(ops)
  }
}

object TableRowFields {
  val tableId = "tableId"
  val sheetName = "sheetName"
  val rowIndex = "rowIndex"
  val cellsField = "cells"
  object cells {
    val key = "key"
    val value = "value"
  }
}