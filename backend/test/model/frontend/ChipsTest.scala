package model.frontend

import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers
import play.api.libs.json.Json

class ChipsTest extends AnyFunSuite with Matchers {

  private def chip(name: String, value: String, op: String, t: String): String =
    Json.stringify(Json.obj("n" -> name, "v" -> value, "op" -> op, "t" -> t))

  private def q(elements: String*): String = s"[${elements.mkString(",")}]"

  private def quoted(s: String): String = s""""$s""""

  // ── Single-value chips ──────────────────────────────────────────────

  test("single-value text chip produces correct query clause") {
    val input = q(chip("Body Text", "hello", "+", "text"))
    val result = Chips.parseQueryString(input)
    result.query must be("+(text:(hello) OR metadata.html:(hello))")
  }

  test("single-value Has Field chip") {
    val input = q(chip("Has Field", "ocr", "+", "dropdown"))
    val result = Chips.parseQueryString(input)
    result.query must be("+_exists_:(ocr)")
  }

  test("single-value Language chip") {
    val input = q(chip("Language", "english", "+", "dropdown"))
    val result = Chips.parseQueryString(input)
    result.query must be("+(_exists_:(text.english) OR _exists_:(ocr.english) OR _exists_:(transcript.english))")
  }

  // ── Multi-value chips: single-_word_ template (OR in value) ───────

  test("Has Field OR-joined values produce single clause with OR") {
    val input = q(chip("Has Field", "ocr OR text", "+", "dropdown"))
    val result = Chips.parseQueryString(input)
    // Single _word_ in template → simple replacement, OR stays inside
    result.query must be("+_exists_:(ocr OR text)")
  }

  test("negated Has Field OR-joined values") {
    val input = q(chip("Has Field", "ocr OR text", "-", "dropdown"))
    val result = Chips.parseQueryString(input)
    result.query must be("-_exists_:(ocr OR text)")
  }

  // ── Multi-value chips: multi-_word_ template (must expand per-value) ─

  test("Language OR-joined values expand template per-value") {
    val input = q(chip("Language", "english OR french", "+", "dropdown"))
    val result = Chips.parseQueryString(input)
    // Multi-_word_ template → each value gets its own full expansion, OR'd together
    result.query must be(
      "+((_exists_:(text.english) OR _exists_:(ocr.english) OR _exists_:(transcript.english))" +
      " OR " +
      "(_exists_:(text.french) OR _exists_:(ocr.french) OR _exists_:(transcript.french)))"
    )
  }

  test("negated Language OR-joined values expand correctly") {
    val input = q(chip("Language", "english OR french", "-", "dropdown"))
    val result = Chips.parseQueryString(input)
    result.query must be(
      "-((_exists_:(text.english) OR _exists_:(ocr.english) OR _exists_:(transcript.english))" +
      " OR " +
      "(_exists_:(text.french) OR _exists_:(ocr.french) OR _exists_:(transcript.french)))"
    )
  }

  test("Language with three OR-joined values") {
    val input = q(chip("Language", "english OR french OR arabic", "+", "dropdown"))
    val result = Chips.parseQueryString(input)
    result.query must be(
      "+((_exists_:(text.english) OR _exists_:(ocr.english) OR _exists_:(transcript.english))" +
      " OR " +
      "(_exists_:(text.french) OR _exists_:(ocr.french) OR _exists_:(transcript.french))" +
      " OR " +
      "(_exists_:(text.arabic) OR _exists_:(ocr.arabic) OR _exists_:(transcript.arabic)))"
    )
  }

  // ── Multi-_word_ text chips with plain text (no OR) are unchanged ──

  test("Body Text single value with multi-_word_ template is unchanged") {
    val input = q(chip("Body Text", "hello world", "+", "text"))
    val result = Chips.parseQueryString(input)
    result.query must be("+(text:(hello world) OR metadata.html:(hello world))")
  }

  test("Email From single value with multi-_word_ template is unchanged") {
    val input = q(chip("Email From", "alice", "+", "text"))
    val result = Chips.parseQueryString(input)
    result.query must be("+(metadata.from.name.\\*:(alice) OR metadata.from.address:(alice))")
  }

  // ── Mixed chips ───────────────────────────────────────────────────

  test("mixed chips are concatenated with spaces") {
    val input = q(
      quoted("search text"),
      chip("Has Field", "ocr", "+", "dropdown"),
      chip("Language", "english", "-", "dropdown")
    )
    val result = Chips.parseQueryString(input)
    result.query must be(
      "search text +_exists_:(ocr) -(_exists_:(text.english) OR _exists_:(ocr.english) OR _exists_:(transcript.english))"
    )
  }

  // ── Empty value handling ──────────────────────────────────────────

  test("empty value is replaced with quoted empty string") {
    val input = q(chip("Body Text", "", "+", "text"))
    val result = Chips.parseQueryString(input)
    result.query must be("""+(text:("") OR metadata.html:(""))""")
  }
}
