package model

import play.api.libs.json._

object Languages {
  val all = List(Arabic, English, French, German, Russian, Portuguese, Persian, Spanish, Ukrainian)

  def getByKey(key: String): Option[Language] = {
    all.find(l => l.key == key)
  }

  def getByIso6391Code(code: String) : Option[Language] = {
    all.find(l => l.iso6391Code == code)
  }

  def getByKeyOrThrow(key: String): Language = {
    getByKey(key).getOrElse {
      throw new IllegalStateException(s"Unknown language ${key}")
    }
  }
}

sealed trait Language {
  def key: String
  def ocr: String
  def analyzer: String

  def iso6391Code: String
}

object Language {
   implicit def writes = new Writes[Language] {
    def writes(l: Language) = JsString(l.key)
  }

  implicit  def reads = new Reads[Language] {
    def reads(v: JsValue): JsResult[Language] = Reads.StringReads.reads(v).flatMap(k =>
      Languages.getByKey(k) match {
        case Some(l) => JsSuccess(l)
        case None => JsError(s"Not a known language: $k")
      }
    )
  }
}

object Arabic extends Language {
  override def key = "arabic"
  override def ocr = "ara"
  override def iso6391Code = "ar"
  override def analyzer = "arabic"
}

object English extends Language {
  override def key = "english"
  override def ocr = "eng"
  override def iso6391Code = "en"
  override def analyzer = "english"
}

object French extends Language {
  override def key = "french"
  override def ocr = "fra"
  override def iso6391Code = "fr"
  override def analyzer = "french"
}

object German extends Language {
  override def key = "german"
  override def ocr ="deu"
  override def iso6391Code = "de"
  override def analyzer = "german"
}

// TODO polish elasticsearch plugin
//object Polish extends Language {
//  override def key = "polish"
//  override def ocr = "pol"
//}

object Russian extends Language {
  override def key = "russian"
  override def ocr = "rus"
  override def iso6391Code = "ru"
  override def analyzer = "russian"
}

object Portuguese extends Language {
  override def key = "portuguese"
  override def ocr = "por"
  override def iso6391Code = "pt"
  override def analyzer = "portuguese"
}

object Persian extends Language {
  override def key = "persian"
  override def ocr = "fas"
  override def iso6391Code = "fa"
  override def analyzer = "persian"
}

object Spanish extends Language {
  override def key = "spanish"
  override def ocr = "spa"
  override def iso6391Code = "es"
  override def analyzer = "spanish"
}

object Ukrainian  extends Language {
  override def key = "ukrainian"
  override def ocr = "ukr"
  override def iso6391Code = "uk"
  override def analyzer = "ukrainian"
}