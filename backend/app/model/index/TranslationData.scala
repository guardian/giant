package model.index

import model.frontend.HighlightableText
import model.frontend.HighlightableText._
import play.api.libs.json._

case class LanguageDataField(detectedLanguageCode: Option[String], englishTranslation: Option[String])
case class OcrLanguageData(ocrLanguage: String, detectedLanguageCode: String, englishTranslation: Option[String])
case class TranslationData(text: Option[LanguageDataField],
                           emailSubject: Option[LanguageDataField],
                           emailBody: Option[LanguageDataField],
                           ocr: Option[OcrLanguageData])

// The highlightable variants are what we send to the frontend - the translations they contain can carry
// search highlights, whereas the plain variants above are what we read from and write to elasticsearch.
case class HighlightableLanguageDataField(detectedLanguageCode: Option[String], englishTranslation: Option[HighlightableText])
case class HighlightableOcrLanguageData(ocrLanguage: String, detectedLanguageCode: String, englishTranslation: Option[HighlightableText])
case class HighlightableTranslationData(text: Option[HighlightableLanguageDataField],
                                        emailSubject: Option[HighlightableLanguageDataField],
                                        emailBody: Option[HighlightableLanguageDataField],
                                        ocr: Option[HighlightableOcrLanguageData])

object TranslationData {
  implicit val languageDataFieldFormat: Format[LanguageDataField] = Json.format[LanguageDataField]

  implicit val ocrLanguageDataFormat: Format[OcrLanguageData] = Json.format[OcrLanguageData]

  implicit val translationDataFormat: Format[TranslationData] = Json.format[TranslationData]

  implicit val highlightableLanguageDataFieldFormat: Format[HighlightableLanguageDataField] = Json.format[HighlightableLanguageDataField]
  implicit val highlightableOcrLanguageDataFormat: Format[HighlightableOcrLanguageData] = Json.format[HighlightableOcrLanguageData]
  implicit val highlightableTranslationDataFormat: Format[HighlightableTranslationData] = Json.format[HighlightableTranslationData]

  private def toHighlightableLanguageDataField(field: Option[LanguageDataField]): Option[HighlightableLanguageDataField] = {
    field.map(f => HighlightableLanguageDataField(
      f.detectedLanguageCode,
      f.englishTranslation.map(t => HighlightableText.fromString(t, page = None))
    ))
  }

  private def toHighlightableOcrLanguageData(ocr: Option[OcrLanguageData]): Option[HighlightableOcrLanguageData] = {
    ocr.map(o => HighlightableOcrLanguageData(
      o.ocrLanguage,
      o.detectedLanguageCode,
      o.englishTranslation.map(t => HighlightableText.fromString(t, page = None))
    ))
  }

  def toHighlightableTranslationData(translationData: TranslationData): HighlightableTranslationData = {
    HighlightableTranslationData(
      text = toHighlightableLanguageDataField(translationData.text),
      emailSubject = toHighlightableLanguageDataField(translationData.emailSubject),
      emailBody = toHighlightableLanguageDataField(translationData.emailBody),
      ocr = toHighlightableOcrLanguageData(translationData.ocr)
    )
  }
}
