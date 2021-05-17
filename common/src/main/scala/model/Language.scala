package model

import play.api.libs.json._

object Languages {
  val all = List(Arabic, English, French, German, Russian, Portuguese)

  def getByKey(key: String): Option[Language] = {
    all.find(l => l.key == key)
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
  override def analyzer = "arabic"
}

object English extends Language {
  override def key = "english"
  override def ocr = "eng"
  override def analyzer = "english"
}

object French extends Language {
  override def key = "french"
  override def ocr = "fra"
  override def analyzer = "french"
}

object German extends Language {
  override def key = "german"
  override def ocr ="deu"
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
  override def analyzer = "russian"
}

object Portuguese extends Language {
  override def key = "portuguese"
  override def ocr = "por"
  override def analyzer = "portuguese"
}

