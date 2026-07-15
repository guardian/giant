package model.index

import model.frontend.HighlightableText
import model.frontend.HighlightableText._
import play.api.libs.json._

case class LanguageDataField(detectedLanguageCode: Option[String], translation: Option[String])
case class HighlightableLanguageDataField(detectedLanguageCode: Option[String], translation: Option[HighlightableText])
case class HighlightableOcrLanguageData(detectedLanguageCode: Map[String, String], translation: Map[String, HighlightableText])
case class OcrLanguageData(detectedLanguageCode: Map[String, String], translation: Map[String, String])
case class LanguageData(text: Option[LanguageDataField],
                        emailSubject: Option[LanguageDataField],
                        emailBody: Option[LanguageDataField],
                        ocr: Option[OcrLanguageData])

case class HighlightableLanguageData(text: Option[HighlightableLanguageDataField],
                                     emailSubject: Option[HighlightableLanguageDataField],
                                     emailBody: Option[HighlightableLanguageDataField],
                                     ocr: Option[HighlightableOcrLanguageData])


object LanguageData {
  implicit val languageDataFieldFormat: Format[LanguageDataField] = Json.format[LanguageDataField]

  implicit val ocrLanguageDataFormat: Format[OcrLanguageData] = Json.format[OcrLanguageData]

  implicit val languageDataFormat: Format[LanguageData] = Json.format[LanguageData]

  implicit val highlightableLanguageDataFieldFormat: Format[HighlightableLanguageDataField] = Json.format[HighlightableLanguageDataField]
  implicit val highlightableOcrLanguageDataFormat: Format[HighlightableOcrLanguageData] = Json.format[HighlightableOcrLanguageData]
  implicit val highlightableLanguageDataFormat: Format[HighlightableLanguageData] = Json.format[HighlightableLanguageData]

  def toHighlightableLanguageDataField(field: Option[LanguageDataField]): Option[HighlightableLanguageDataField] = {
    field.map(f => HighlightableLanguageDataField(f.detectedLanguageCode, f.translation.map(t => HighlightableText(t, List.empty))))
  }
  def toHighlightableOcrLanguageData(ocr: Option[OcrLanguageData]): Option[HighlightableOcrLanguageData] = {
    ocr.map(o => HighlightableOcrLanguageData(o.detectedLanguageCode, o.translation.map { case (k, v) => (k, HighlightableText(v, List.empty)) }))
  }
  def toHighLightableLanguageData(languageData: LanguageData): HighlightableLanguageData = {
    HighlightableLanguageData(
      text = toHighlightableLanguageDataField(languageData.text),
      emailSubject = toHighlightableLanguageDataField(languageData.emailSubject),
      emailBody = toHighlightableLanguageDataField(languageData.emailBody),
      ocr = toHighlightableOcrLanguageData(languageData.ocr)
    )
  }
}
