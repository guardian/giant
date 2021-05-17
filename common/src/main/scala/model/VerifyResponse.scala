package model

import play.api.libs.json.{Format, Json}

case class VerifyResponse(numberOfFilesInIndex: Int, filesNotIndexed: List[String], filesInError: Map[String, String])
object VerifyResponse {
  implicit val format: Format[VerifyResponse] = Json.format[VerifyResponse]
}
