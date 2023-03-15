package extraction.tables

import java.io.File
import java.nio.charset.StandardCharsets

import extraction.{ExtractionParams, FileExtractor}
import model.index.TableRow
import model.manifest.Blob
import org.apache.commons.csv.{CSVFormat, CSVParser}
import services.ScratchSpace
import services.table.Tables
import utils.attempt.{Attempt, Failure}
import utils.attempt.AttemptAwait._

import scala.jdk.CollectionConverters._
import scala.concurrent.ExecutionContext

class CsvTableExtractor(scratch: ScratchSpace, tableOps: Tables)(implicit ec: ExecutionContext) extends FileExtractor(scratch) {
  val mimeTypes = Set(
    "text/csv"
  )

  override def canProcessMimeType: String => Boolean = mimeTypes.contains

  override def indexing: Boolean = true

  override def priority: Int = 5

  private val format = CSVFormat.RFC4180.builder().setHeader().build()

  override def extract(blob: Blob, file: File, params: ExtractionParams): Either[Failure, Unit] = {
    // TODO assume charset?? BAD???
    val parser = CSVParser.parse(file, StandardCharsets.UTF_8, format)
    Attempt.sequence(
      parser.getRecords.asScala.zipWithIndex.map { case (record, rowIndex) =>
        val row = TableRow(
          sheetName = None,
          rowIndex = rowIndex,
          cells = record.toMap.asScala.toMap)
        tableOps.addDocumentRows(blob.uri, Seq(row))
      }
    ).awaitEither().map(_ => ())
  }
}
