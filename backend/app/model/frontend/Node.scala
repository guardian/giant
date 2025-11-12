package model.frontend

import play.api.libs.json.{Format, Json}

case class Node(hostname: String, reachable: Boolean)

object Node {
  implicit val nodeFormat: Format[Node] = Json.format[Node]
}
