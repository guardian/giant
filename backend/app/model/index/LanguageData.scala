package model.index

import model.Email
import play.api.libs.json._
import play.api.libs.functional.syntax._

case class LanguageDataField(detectedLanguageCode: Option[String], translation: Option[String], textToTranslate: Option[String] = None)
case class OcrLanguageData(detectedLanguageCode: Map[String, String], translation: Map[String, String], textToTranslate: Map[String, String] = Map())
case class LanguageData(text: Option[LanguageDataField],
                        emailSubject: Option[LanguageDataField],
                        emailBody: Option[LanguageDataField],
                        ocr: Option[OcrLanguageData])

object LanguageData {
  implicit val languageDataFieldFormat: Format[LanguageDataField] = Json.format[LanguageDataField]

  implicit val ocrLanguageDataReads: Reads[OcrLanguageData] = (
    (__ \ "detectedLanguageCode").read[Map[String, String]] and
    (__ \ "translation").read[Map[String, String]] and
    (__ \ "textToTranslate").read[Map[String, String]].orElse(Reads.pure(Map.empty[String, String]))
  )(OcrLanguageData.apply _)

  implicit val ocrLanguageDataWrites: Writes[OcrLanguageData] = Json.writes[OcrLanguageData]
  implicit val ocrLanguageDataFormat: Format[OcrLanguageData] = Format(ocrLanguageDataReads, ocrLanguageDataWrites)

  implicit val languageDataFormat: Format[LanguageData] = Json.format[LanguageData]

  private def filterNonEnglishField(languageDataField: Option[LanguageDataField]): Option[LanguageDataField] = {
    if (languageDataField.exists(_.detectedLanguageCode.exists(_ != "en"))) languageDataField else None
  }

  private def filterNonEnglishOcr(ocrLanguageData: Option[OcrLanguageData]): Option[OcrLanguageData] = {
    val nonEnglishDetectedLanguageCode = ocrLanguageData.exists(_.detectedLanguageCode.exists(_._2 != "en"))
    if (nonEnglishDetectedLanguageCode) {
      ocrLanguageData
    } else {
      None
    }
  }

  def filterNonEnglish(languageData: Option[LanguageData]): Option[LanguageData] = {
    val filteredData = languageData.map { ld =>
      ld.copy(
        text = filterNonEnglishField(ld.text),
        emailSubject = filterNonEnglishField(ld.emailSubject),
        emailBody = filterNonEnglishField(ld.emailBody),
        ocr = filterNonEnglishOcr(ld.ocr)
      )
    }
    // throw away the whole LanguageData if all fields are None or English
    if (filteredData.exists(d => d.text.isDefined || d.emailSubject.isDefined || d.emailBody.isDefined || d.ocr.isDefined)) {
      filteredData
    } else {
      None
    }
  }

  def addTextToTranslate(languageData: Option[LanguageData], email: Email): Option[LanguageData] = {
    val updatedLanguageData = languageData.map { ld =>
      ld.copy(
        emailSubject = ld.emailSubject.map(td => td.copy(textToTranslate = Some(email.subject))),
        emailBody = ld.emailBody.map(td => td.copy(textToTranslate = Some(email.body)))
      )
    }
    updatedLanguageData
  }

  def addTextToTranslate(languageData: Option[LanguageData], document: Document): Option[LanguageData] = {
    val updatedLanguageData = languageData.map { ld =>
      ld.copy(
        text = ld.text.map(td => td.copy(textToTranslate = Some(document.text))),
        ocr = ld.ocr.map(ocr => ocr.copy(textToTranslate = ocr.detectedLanguageCode.keys.map(k => k -> document.ocr.flatMap(_.get(k)).getOrElse("")).toMap))
      )
    }
    updatedLanguageData
  }
}
