package model.index

import play.api.libs.json._

case class LanguageDataField(detectedLanguageCode: Option[String], englishTranslation: Option[String])
case class OcrLanguageData(ocrLanguage: String, detectedLanguageCode: String, englishTranslation: Option[String])
case class TranslationData(text: Option[LanguageDataField],
                           emailSubject: Option[LanguageDataField],
                           emailBody: Option[LanguageDataField],
                           ocr: Option[OcrLanguageData])

object TranslationData {
  implicit val languageDataFieldFormat: Format[LanguageDataField] = Json.format[LanguageDataField]

  implicit val ocrLanguageDataFormat: Format[OcrLanguageData] = Json.format[OcrLanguageData]

  implicit val translationDataFormat: Format[TranslationData] = Json.format[TranslationData]
}
