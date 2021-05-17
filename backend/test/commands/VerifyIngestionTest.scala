package commands

import model.manifest.Blob
import model.{Uri, VerifyRequestFile, VerifyResponse}
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class VerifyIngestionTest extends AnyFunSuite with Matchers {
  test("missing from index") {
    val file = VerifyRequestFile("test", None)
    val blob = Blob(Uri("1234567"), 5, Set.empty)

    val missing = build().verify(base, file, Map("other" -> blob)).filesNotIndexed
    missing must be(List("test"))
  }

  test("incorrect digest") {
    val file = VerifyRequestFile("test", Some("abcdefg"))
    val blob = Blob(Uri("1234567"), 5, Set.empty)

    val missing = build().verify(base, file, Map("test" -> blob)).filesInError
    missing must contain key "test"
  }

  test("relativise") {
    val files = List(
      VerifyRequestFile("a/b", None),
      VerifyRequestFile("c", Some("123456")),
      VerifyRequestFile("d/e/f", None)
    )

    val expected = List(
      VerifyRequestFile("collection/ingestion/a/b", None),
      VerifyRequestFile("collection/ingestion/c", Some("123456")),
      VerifyRequestFile("collection/ingestion/d/e/f", None)
    )

    VerifyIngestion.relativise("collection", "ingestion", files) must be(expected)
  }

  def base: VerifyResponse = VerifyResponse(5, List.empty, Map.empty)
  def build(): VerifyIngestion = new VerifyIngestion(List.empty, null)
}
