package utils

import play.api.libs.json._
import play.api.libs.json.Json.obj

abstract class VersionedFormat[T] {
  val current: Format[T]
  val version: Int = 1

  def read(version: Int, json: JsValue): JsResult[T] = {
    if(version != this.version) {
      JsError(s"Unsupported version $version")
    } else {
      json.validate[T](current)
    }
  }

  implicit val format: Format[T] = new Format[T] {
    override def writes(o: T): JsValue = obj(
      "version" -> version,
      "data" -> current.writes(o)
    )
    override def reads(json: JsValue): JsResult[T] = for {
      version <- (json \ "version").validate[Int]
      data <- (json \ "data").validate[JsValue]
      result <- read(version, data)
    } yield {
      result
    }
  }
}
