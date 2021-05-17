package model

import play.api.libs.json.{Format, Json}

case class VerifyRequest(files: List[VerifyRequestFile])
object VerifyRequest {
  implicit val format: Format[VerifyRequest] = Json.format[VerifyRequest]
}

case class VerifyRequestFile(path: String, fingerprint: Option[String])
object VerifyRequestFile {
  implicit val format: Format[VerifyRequestFile] = Json.format[VerifyRequestFile]
}
