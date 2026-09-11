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

  private def best(textByLanguage: (Language, String)*): Option[BaseOcrExtractor.BestLanguage] =
    BaseOcrExtractor.bestOcrLanguage(textByLanguage.toMap, languageDetector)

  private def bestOcrLanguage(textByLanguage: (Language, String)*): Option[Language] =
    best(textByLanguage: _*).map(_.ocrLanguage)

  it should "pick English for an English document OCR'd in both languages" in {
    bestOcrLanguage(
      English -> ocrOutput("english-ocrd-english"),
      Russian -> ocrOutput("english-ocrd-in-russian")
    ) should be(Some(English))
  }

  it should "pick English even when the garbled Russian OCR contains some valid Russian" in {
    bestOcrLanguage(
      English -> ocrOutput("english-ocrd-english"),
      Russian -> ocrOutput("english-ocrd-in-russian-with-some-valid-russian")
    ) should be(Some(English))
  }

  it should "pick Russian for a Russian document OCR'd in both languages" in {
    bestOcrLanguage(
      English -> ocrOutput("russian-ocrd-in-english"),
      Russian -> ocrOutput("russian-ocrd-in-russian")
    ) should be(Some(Russian))
  }

  it should "pick Russian even when the garbled English OCR contains some valid English" in {
    bestOcrLanguage(
      English -> ocrOutput("russian-ocrd-in-english-with-random-english"),
      Russian -> ocrOutput("russian-ocrd-in-russian")
    ) should be(Some(Russian))
  }

  it should "return nothing when there is no OCR output" in {
    best() should be(None)
  }

  it should "report the detected language code even when it is not a supported ingestion language" in {
    // A Dutch document OCR'd in English still comes out as readable Dutch, so we should report nl even though
    // Dutch is not one of our supported languages
    val dutch =
      """Het weer in Nederland is de laatste dagen bijzonder wisselvallig geweest. In het westen van het land viel er
        |vanochtend veel regen, terwijl het in het oosten juist droog bleef en de zon af en toe doorbrak. Volgens het
        |KNMI blijft het de komende week onstuimig, met kans op zware windstoten aan de kust en langs het IJsselmeer.
        |De temperatuur ligt rond de twaalf graden, wat voor de tijd van het jaar aan de zachte kant is. Automobilisten
        |worden gewaarschuwd voor gladde wegen in de vroege ochtend en wordt geadviseerd om rustig te rijden.""".stripMargin

    val result = best(English -> dutch)

    result.map(_.ocrLanguage) should be(Some(English))
    result.map(_.detectedLanguageCode) should be(Some("nl"))
  }
}

