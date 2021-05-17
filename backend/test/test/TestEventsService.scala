package test

import java.time.Instant

import services.events.{Event, EventFilter, EventType, Events, FindEventsResponse, TagEquals, TagNotEquals}
import utils.attempt.Attempt

class TestEventsService(initialEvents: List[Event]) extends Events {
  var events: List[Event] = initialEvents

  override def setup(): Attempt[Events] = Attempt.Right(this)

  override def record(eventType: EventType, description: String, tags: Map[String, String]): Unit = {
    events :+= Event(eventType, Instant.now().toEpochMilli, description, tags)
  }

  override def find(start: Option[Long], end: Option[Long], filters: List[EventFilter], page: Int, pageSize: Int): Attempt[FindEventsResponse] = {
    val responseEvents = if(filters.isEmpty) {
      events
    } else {
      events.filter { event =>
        filters.forall {
          case TagEquals(key, value) => event.tags.get(key).contains(value)
          case TagNotEquals(key, value) => !event.tags.get(key).contains(value)
        }
      }
    }
      Attempt.Right(FindEventsResponse(responseEvents, responseEvents.size, responseEvents.size, 1))
    }
}
