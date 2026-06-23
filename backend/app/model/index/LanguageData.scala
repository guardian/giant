package model.index

import play.api.libs.json._

case class LanguageDataField(detectedLanguageCode: Option[String], translation: Option[String])
case class OcrLanguageData(detectedLanguageCode: Map[String, String], translation: Map[String, String])
case class LanguageData(text: Option[LanguageDataField],
                        emailSubject: Option[LanguageDataField],
                        emailBody: Option[LanguageDataField],
                        ocr: Option[OcrLanguageData])

object LanguageData {
  implicit val languageDataFieldFormat: Format[LanguageDataField] = Json.format[LanguageDataField]
  implicit val ocrLanguageDataFormat: Format[OcrLanguageData] = Json.format[OcrLanguageData]
  implicit val languageDataFormat: Format[LanguageData] = Json.format[LanguageData]
}
