package services.observability
import play.api.libs.json.{Json}
import scalikejdbc._
import services.observability.IngestionEvent.IngestionEvent
import org.postgresql.util.PSQLException
import scala.util.{Failure, Success, Try}
import akka.http.scaladsl.model.headers.LinkParams
import akka.event.Logging
import utils.Logging


class DBClient (url: String, user: String, password: String) extends Logging {
	// initialize JDBC driver & connection pool
	Class.forName("org.postgresql.Driver")
	ConnectionPool.singleton(url, user, password)
	implicit val session = AutoSession

	import Details.detailsFormat
	def insertRow (blobId: String, ingestUri: String, eventType: IngestionEvent, eventStatus: String, details: Option[Details] = None) = {
		Try {
			val detailsJson = details.map(Json.toJson(_).toString).getOrElse("{}")
			sql"""
			INSERT INTO ingestion_events (
				blob_id,
				ingest_uri,
				type,
				status,
				details,
				created_at
			) VALUES (
				$blobId,
				$ingestUri,
				${eventType.toString()},
				$eventStatus,
				$detailsJson::JSONB,
				now()
			);""".execute().apply()
		} match {
			case Success(_) => {
				true
			}
			case Failure(exception) => {
				logger.error(s"""
					An exception ocurred while inserting ingestion event
					blobId: ${blobId}, ingestUri: ${ingestUri} eventType: ${eventType}
					exception: ${exception.getMessage()}"""
				)
				false
			}
		}
	}
}