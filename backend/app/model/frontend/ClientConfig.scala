package model.frontend

import play.api.libs.json._
import utils.buildinfo.BuildInfo

// Config which we need to ship to the client to improve UX
// e.g. Knowing the min password length without actually submitting a user creation, or avoiding the 2FA setup page if it's not required.
case class ClientConfig(label: Option[String],
                        readOnly: Boolean,
                        userProvider: String,
                        authConfig: Map[String, JsValue],
                        hideDownloadButton: Boolean,
                        buildInfo: Map[String, String] = BuildInfo.toMap.view.mapValues(_.toString).toMap)

object ClientConfig {
  implicit val format = Json.format[ClientConfig]
}
