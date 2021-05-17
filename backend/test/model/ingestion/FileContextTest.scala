package model.ingestion

import model.{English, Uri}
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class FileContextTest extends AnyFunSuite with Matchers {
  test("reject ingestion names that do not also include the collection") {
    val input = build("collection", "file.txt", "collection")

    FileContext.fromIngestMetadata(input).isLeft must be(true)
  }

  test("reject when uri does not contain parent uri") {
    val input = build(
      ingestion = "collection/ingestion",
      parentUri = "collection/ingestion/a/folder/structure",
      uri = "file.txt"
    )

    FileContext.fromIngestMetadata(input).isLeft must be(true)
  }

  test("prepend ingestion name to parent uri") {
    val input = build(
      ingestion = "collection/ingestion",
      parentUri = "a/folder/structure",
      uri = "a/folder/structure/file.txt"
    )

    val expected = List(
      Uri("collection/ingestion/a/folder/structure"),
      Uri("collection/ingestion/a/folder"),
      Uri("collection/ingestion/a"),
      Uri("collection/ingestion")
    )

    val actual = FileContext.fromIngestMetadata(input).right.get.parents
    actual must be(expected)
  }

  test("do not prepend ingestion name to parent uri if already there") {
    val input = build(
      ingestion = "collection/ingestion",
      parentUri = "collection/ingestion/a/folder/structure",
      uri = "collection/ingestion/a/folder/structure/file.txt"
    )

    val expected = List(
      Uri("collection/ingestion/a/folder/structure"),
      Uri("collection/ingestion/a/folder"),
      Uri("collection/ingestion/a"),
      Uri("collection/ingestion")
    )

    val actual = FileContext.fromIngestMetadata(input).right.get.parents
    actual must be(expected)
  }

  test("handle file directly under ingestion") {
    val input = build(
      ingestion = "collection/ingestion",
      parentUri = "collection/ingestion",
      uri = "collection/ingestion/file.txt"
    )

    val expected = List(
      Uri("collection/ingestion")
    )

    val actual = FileContext.fromIngestMetadata(input).right.get.parents
    actual must be(expected)
  }

  def build(ingestion: String, uri: String, parentUri: String): IngestMetadata = IngestMetadata(
    ingestion,
    file = IngestionFile(
      uri = Uri(uri),
      parentUri = Uri(parentUri),
      -1, None, None, None, isRegularFile = true
    ),
    languages = List(English)
  )
}
