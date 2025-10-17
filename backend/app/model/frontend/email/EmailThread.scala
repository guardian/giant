package model.frontend.email

import java.time.OffsetDateTime
import org.neo4j.driver.v1.Value
import utils.attempt.Attempt
import model._
import play.api.libs.json.{Json, Writes}

import scala.jdk.CollectionConverters._
import scala.concurrent.ExecutionContext

case class EmailMetadata(subject: Option[String], fromAddress: Option[String], fromName: Option[String], sentAt: Option[ExtractedDateTime])

object EmailMetadata {
  implicit val writes: Writes[EmailMetadata] = Json.writes[EmailMetadata]
}

case class Email(uri: String, haveSource: Boolean, display: Option[String], metadata: Option[EmailMetadata] = None)

object Email {
  def fromValue(v: Value)(implicit ec: ExecutionContext): Attempt[Email] = {
    for {
      uri <- v.get("uri").attempt(_.asString)
      maybeHaveSource <- v.get("haveSource").attemptOpt(_.asBoolean)
      display <- v.get("display").attemptOpt(_.asString)
    } yield Email(uri, maybeHaveSource.getOrElse(false), display)
  }

  implicit val writes: Writes[Email] = Json.writes[Email]
}

case class Neighbour(relation: String, uri: String)

object Neighbour {
  def fromValue(v: Value)(implicit ec: ExecutionContext): Attempt[Neighbour] = {
    for {
      uri <- v.get("uri").attempt(_.asString)
      relation <- v.get("relation").attempt(_.asString)
    } yield Neighbour(relation, uri)
  }

  implicit val writes: Writes[Neighbour] = Json.writes[Neighbour]
}

case class EmailNeighbours(email: Email, neighbours: Set[Neighbour]) {
  lazy val uris = (email.uri :: neighbours.map(_.uri).toList).distinct
}

object EmailNeighbours {
  def fromValues(email: Value, neighbours: Value)(implicit ec: ExecutionContext): Attempt[EmailNeighbours] = {
    for {
      email <- Email.fromValue(email)
      neighbours <- Attempt.traverse(neighbours.asList(v => v).asScala.toList)(Neighbour.fromValue)
    } yield EmailNeighbours(email, neighbours.toSet)
  }

  implicit val writes: Writes[EmailNeighbours] = Json.writes[EmailNeighbours]
}
