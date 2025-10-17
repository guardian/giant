package services.events

import java.time.Instant

import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.ElasticClient
import com.sksamuel.elastic4s.requests.searches.queries.RangeQuery
import model.frontend.Paging
import play.api.libs.json._
import services.ElasticsearchSyntax
import services.ElasticsearchSyntax.NestedField
import utils.Logging
import utils.attempt.Attempt

import scala.concurrent.ExecutionContext

sealed trait EventType
case object ActionStarted extends EventType
case object ActionComplete extends EventType
case object ActionFailed extends EventType

object EventType {
  def fromString(eventType: String) = eventType match {
    case "ActionStarted" => ActionStarted
    case "ActionComplete" => ActionComplete
    case "ActionFailed" => ActionFailed
    case _ => throw new IllegalArgumentException(s"$eventType is not a valid EventType")
  }

  implicit val format: Format[EventType] = Format(
    {
      case JsString("ActionStarted") => JsSuccess(ActionStarted)
      case JsString("ActionComplete") => JsSuccess(ActionComplete)
      case JsString("ActionFailed") => JsSuccess(ActionFailed)
      case unknown => JsError(s"Unknown EventType $unknown")
    },
    {
      case ActionStarted => JsString("ActionStarted")
      case ActionComplete => JsString("ActionComplete")
      case ActionFailed => JsString("ActionFailed")
    }
  )
}

case class Event(eventType: EventType, timestamp: Long, description: String, tags: Map[String, String])
object Event {
  implicit val eventResponseFormat: Format[Event] = Json.format[Event]
}

case class FindEventsResponse(results: List[Event], hits: Long, pageSize: Long, page: Long) extends Paging[Event]
object FindEventsResponse {
  implicit val findEventsResponseFormat: Format[FindEventsResponse] = Json.format[FindEventsResponse]
}

sealed trait EventFilter
case class TagEquals(key: String, value: String) extends EventFilter
case class TagNotEquals(key: String, value: String) extends EventFilter

trait Events {
  def setup(): Attempt[Events]
  def record(eventType: EventType, description: String, tags: Map[String, String]): Unit
  // start inclusive, end exclusive
  def find(
    start: Option[Long] = None,
    end: Option[Long] = None,
    filters: List[EventFilter] = List.empty,
    page: Int = 0,
    pageSize: Int = 1000
  ): Attempt[FindEventsResponse]
}


class ElasticsearchEvents(override val client: ElasticClient, eventIndexName: String)(implicit ec: ExecutionContext) extends Events with Logging with ElasticsearchSyntax {
  import services.index.HitReaders.EventHitReader

  override def setup(): Attempt[Events] = {
    createIndexIfNotAlreadyExists(eventIndexName,
      properties(
        textKeywordField(EventFields.eventType),
        dateField(EventFields.timestamp),
        textField(EventFields.description),
        nestedField(EventFields.tagsField).fields(
          textKeywordField(EventFields.tags.key),
          textKeywordField(EventFields.tags.values)
        )
      )
    ).map(_ => this)
  }

  override def record(eventType: EventType, description: String, tags: Map[String, String]): Unit = {
    executeNoReturn {
      indexInto(eventIndexName).fields(
        EventFields.eventType -> eventType.toString,
        EventFields.timestamp -> Instant.now().toEpochMilli,
        EventFields.description -> description,
        EventFields.tagsField -> tags.map {
          case (k, v) => Map(EventFields.tags.key -> k, EventFields.tags.values -> v)
        }
      )
    }
  }

  override def find(start: Option[Long], end: Option[Long], filters: List[EventFilter] = List.empty, page: Int, pageSize: Int): Attempt[FindEventsResponse] = {
    val filterTerms = filters.collect { case TagEquals(k, v) => getFilterTerm(k, v) }
    val mustNotTerms = filters.collect { case TagNotEquals(k, v) => getFilterTerm(k, v) }

    execute {
      search(eventIndexName)
        .query(boolQuery().filter(getRangeQuery(start, end) ++ filterTerms).not(mustNotTerms))
        .sortByFieldDesc(EventFields.timestamp)
        .size(pageSize)
        .from(page * pageSize)
    }.map { resp =>
      val events = resp.hits.hits.map(_.to[Event]).toList
      val total = resp.totalHits
      FindEventsResponse(events, total.toInt, pageSize, page)
    }
  }

  private def getRangeQuery(start: Option[Long], end: Option[Long]): Option[RangeQuery] = (start, end) match {
    case (Some(s), Some(e)) =>
      Some(rangeQuery(EventFields.timestamp).gte(s).lt(e))

    case (Some(s), None) =>
      Some(rangeQuery(EventFields.timestamp).gte(s))

    case (None, Some(e)) =>
      Some(rangeQuery(EventFields.timestamp).lt(e))

    case _ =>
      None
  }

  private def getFilterTerm(k: String, v: String) = {
    nestedQuery(EventFields.tagsField,
      boolQuery().must(
        termQuery(EventFields.tagsField + "." + NestedField.key + ".keyword", k),
        termQuery(EventFields.tagsField + "." + NestedField.values + ".keyword", v)
      )
    )
  }
}

object EventFields {
  val eventsField = "events"
  val eventType = "eventType"
  val timestamp = "timestamp"
  val description = "description"
  val tagsField = "tags"
  object tags {
    val key = "key"
    val values = "values"
  }
}
