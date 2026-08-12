package extraction.ocr

import model.{English, Language, Russian}
import org.apache.tika.language.detect.LanguageDetector
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

import scala.io.Source
import scala.util.Using

/**
  * Real tesseract output for the English and Russian Wikipedia pages about Solaris, OCR'd in both languages. The
  * "wrong" language runs are garbled, but can still contain snippets of valid text, which shouldn't fool us.
  */
class BaseOcrExtractorTest extends AnyFlatSpec with Matchers {
  private val languageDetector = LanguageDetector.getDefaultLanguageDetector.loadModels()

  private def ocrOutput(name: String): String = {
    val stream = getClass.getClassLoader.getResourceAsStream(s"ingestme/tesseract-out/$name.txt")
    require(stream != null, s"Missing test resource $name.txt")
    Using.resource(Source.fromInputStream(stream, "UTF-8"))(_.mkString)
  }

  private def best(textByLanguage: (Language, String)*): Option[Language] =
    BaseOcrExtractor.bestOcrLanguage(textByLanguage.toMap, languageDetector)

  it should "pick English for an English document OCR'd in both languages" in {
    best(
      English -> ocrOutput("english-ocrd-english"),
      Russian -> ocrOutput("english-ocrd-in-russian")
    ) should be(Some(English))
  }

  it should "pick English even when the garbled Russian OCR contains some valid Russian" in {
    best(
      English -> ocrOutput("english-ocrd-english"),
      Russian -> ocrOutput("english-ocrd-in-russian-with-some-valid-russian")
    ) should be(Some(English))
  }

  it should "pick Russian for a Russian document OCR'd in both languages" in {
    best(
      English -> ocrOutput("russian-ocrd-in-english"),
      Russian -> ocrOutput("russian-ocrd-in-russian")
    ) should be(Some(Russian))
  }

  it should "pick Russian even when the garbled English OCR contains some valid English" in {
    best(
      English -> ocrOutput("russian-ocrd-in-english-with-random-english"),
      Russian -> ocrOutput("russian-ocrd-in-russian")
    ) should be(Some(Russian))
  }

  it should "return nothing when there is no OCR output" in {
    best() should be(None)
  }
}

