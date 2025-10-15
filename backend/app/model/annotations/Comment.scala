package model.annotations
import model._
import model.frontend.user.PartialUser
import org.neo4j.driver.v1.Value
import play.api.libs.json.{Format, JsError, JsObject, JsResult, JsString, JsValue, Json}

case class Comment(id: String, author: PartialUser, postedAt: Long, text: String, anchor: Option[CommentAnchor])


object Comment {
  implicit val format: Format[Comment] = Json.format[Comment]

  def fromNeo4jValue(definition: Value, user: PartialUser): Comment = {
    Comment(
      definition.get("id").asString(),
      user,
      definition.get("postedAt").asLong(),
      definition.get("text").asString(),
      definition.get("anchor").optionally { v => Json.parse(v.asString()).as[CommentAnchor] }
    )
  }
}

sealed trait CommentAnchor
case class TextCommentAnchor(startCharacter: Int, endCharacter: Int) extends CommentAnchor
case class OcrCommentAnchor(language: Language, startCharacter: Int, endCharacter: Int) extends CommentAnchor
// TODO MRB: introduce pt rectangle bounds for adding comments to the preview (and unified document viewer?)

object CommentAnchor {
  val textCommentAnchorFormat: Format[TextCommentAnchor] = Json.format[TextCommentAnchor]
  val ocrCommentAnchor: Format[OcrCommentAnchor] = Json.format[OcrCommentAnchor]

  implicit val format: Format[CommentAnchor] = new Format[CommentAnchor] {
    override def reads(json: JsValue): JsResult[CommentAnchor] = {
      (json \ "type").validate[String].flatMap {
        case "text" => json.validate[TextCommentAnchor](textCommentAnchorFormat.reads _)
        case "ocr" => json.validate[OcrCommentAnchor](ocrCommentAnchor.reads _)
        case other => JsError(s"Unknown CommentAnchor type ${other}")
      }
    }
    override def writes(o: CommentAnchor): JsValue = {
      o match {
        case tca: TextCommentAnchor => Json.toJson(tca)(textCommentAnchorFormat.writes _).as[JsObject] + ("type" -> JsString("text"))
        case oca: OcrCommentAnchor => Json.toJson(oca)(ocrCommentAnchor.writes _).as[JsObject] + ("type" -> JsString("ocr"))
      }
    }
  }
}