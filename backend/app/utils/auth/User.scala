package utils.auth

import play.api.libs.json.{Format, JsObject, JsString, Json}
import net.logstash.logback.marker.LogstashMarker
import net.logstash.logback.marker.Markers.appendRaw


/* User model that is passed into Actions */
case class User(username: String, displayName: String) {
  def asLogMarker: LogstashMarker = appendRaw("user",
    // { user: { name: xyz } } for compatibility with the default filebeat index template
    Json.stringify(JsObject(Seq("name" -> JsString(username)))))
}

object User {
  implicit val userFormat: Format[User] = Json.format[User]
}
