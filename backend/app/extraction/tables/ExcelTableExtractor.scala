package extraction.tables

import java.io.File

import extraction.{ExtractionParams, FileExtractor}
import javax.xml.stream.{XMLInputFactory, XMLStreamReader}
import model.index.TableRow
import model.manifest.Blob

import org.apache.poi.ss.util.CellReference
import org.apache.poi.openxml4j.opc.{OPCPackage, PackageAccess}
import org.apache.poi.xssf.eventusermodel.XSSFReader.SheetIterator
import org.apache.poi.xssf.eventusermodel.{ReadOnlySharedStringsTable, XSSFReader}
import org.apache.poi.xssf.usermodel.{XSSFCellStyle, XSSFRichTextString}
import org.apache.poi.ss.usermodel.DateUtil
import org.apache.poi.xssf.model.StylesTable
import services.ScratchSpace
import services.table.Tables
import utils.Logging
import utils.attempt.AttemptAwait._
import utils.attempt.{Attempt, Failure}

import scala.concurrent.ExecutionContext
import scala.util.control.Breaks.{break, breakable}

class ExcelTableExtractor(scratch: ScratchSpace, tableOps: Tables)(implicit ec: ExecutionContext) extends FileExtractor(scratch) with Logging {
  val mimeTypes = Set(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )

  override def canProcessMimeType: String => Boolean = mimeTypes.contains

  override def indexing: Boolean = true

  override def priority: Int = 5

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    var result: List[Attempt[Unit]] = List.empty
    val opcPkg = OPCPackage.open(file.getPath, PackageAccess.READ)
    val stringsTable = new ReadOnlySharedStringsTable(opcPkg)
    val xssfReader = new XSSFReader(opcPkg)
    val stylesTable = xssfReader.getStylesTable
    val factory = XMLInputFactory.newInstance
    val inputStream = xssfReader.getSheetsData
    while (inputStream.hasNext) {
      val nextInputStream = inputStream.next()
      val xmlReader: XMLStreamReader = factory.createXMLStreamReader(nextInputStream)
      val sheetName = inputStream.asInstanceOf[SheetIterator].getSheetName

      breakable {
        while (xmlReader.hasNext) {
          result :+= readRows(1000, xmlReader, stringsTable, stylesTable, sheetName, blob)
          if (xmlReader.isStartElement && xmlReader.getLocalName.equals("sheetData")) break()
        }
      }
    }
    if (opcPkg != null) opcPkg.close()
    Attempt.sequence(result).awaitEither().map(_ => ())
  }

  def readRows(batchSize: Int, xmlReader: XMLStreamReader, stringsTable: ReadOnlySharedStringsTable, stylesTable: StylesTable, sheetName: String, blob: Blob): Attempt[Unit] = {
    var dataRows: List[TableRow] = List.empty
    if (batchSize > 0) {
      breakable {
        while (xmlReader.hasNext) {
          xmlReader.next
          if (xmlReader.isStartElement)
            if (xmlReader.getLocalName.equals("row")) {
              val dataRow = getDataRow(xmlReader, stringsTable, sheetName, stylesTable)
              if (dataRow.isDefined)
                dataRows :+= dataRow.get
            }
          if (dataRows.size == batchSize) break()
        }
      }
    }
    if (dataRows.nonEmpty) tableOps.addDocumentRows(blob.uri, dataRows) else Attempt.Right(())
  }

  private def getDataRow(xmlReader: XMLStreamReader, stringsTable: ReadOnlySharedStringsTable, sheetName: String, stylesTable: StylesTable): Option[TableRow] = {
    var rowValues: List[String] = List.empty
    var cellReference: CellReference = null
    breakable {
      while (xmlReader.hasNext) {
        xmlReader.next
        if (xmlReader.isStartElement) {
          if (xmlReader.getLocalName.equals("c")) {
            cellReference = new CellReference(xmlReader.getAttributeValue(null, "r"))
            // Fill in the possible blank cells!
            while (rowValues.size < cellReference.getCol) { rowValues :+= "" }
            val cellType = xmlReader.getAttributeValue(null, "t")
            val cellStyleStr = xmlReader.getAttributeValue(null, "s")
            val cellValue = getCellValue(cellType, xmlReader, stringsTable, stylesTable, cellStyleStr)
            rowValues :+= cellValue
          }
        }
        if (xmlReader.isEndElement && xmlReader.getLocalName.equals("row")) break()
      }
    }
    if (cellReference != null)
      Some(TableRow(Some(sheetName), cellReference.getRow, rowValues.zipWithIndex.map{ case (cell, index) => index.toString -> cell }.toMap))
    else None
  }

  private def getCellValue(cellType: String, xmlReader: XMLStreamReader, stringsTable: ReadOnlySharedStringsTable, stylesTable: StylesTable, cellStyleStr: String): String = {
    var value = "" // by default
    breakable {
      while (xmlReader.hasNext) {
        xmlReader.next
        if (xmlReader.isStartElement) {
          if (xmlReader.getLocalName.equals("v")) {
            if (cellType != null && cellType == "s") {
              val idx = xmlReader.getElementText.toInt
              value = stringsTable.getItemAt(idx).getString
            } else {
              // Get the style of the cell in order to determine whether is a date
              val style = getStyle(cellStyleStr, stylesTable)
              val formatIndex = style.getDataFormat
              val formatString = style.getDataFormatString

              if(DateUtil.isADateFormat(formatIndex, formatString)) {
                val date = DateUtil.getJavaDate(xmlReader.getElementText.toDouble)
                if (date != null) {
                  value = date.toString
                }
              } else value = xmlReader.getElementText
            }
          }
        }

        if (xmlReader.isEndElement && xmlReader.getLocalName.equals("c")) break()
      }
    }
    value
  }

  private def getStyle(cellStyleStr: String, stylesTable: StylesTable): XSSFCellStyle =
    if (stylesTable != null) {
      if (cellStyleStr != null) {
        val styleIndex = cellStyleStr.toInt
        stylesTable.getStyleAt(styleIndex)
      } else {
        if (stylesTable.getNumCellStyles > 0) {
          stylesTable.getStyleAt(0)
        } else new XSSFCellStyle(stylesTable)
      }
    } else new XSSFCellStyle(stylesTable)
}
