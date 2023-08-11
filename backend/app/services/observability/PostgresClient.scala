package services.observability
import play.api.libs.json.Json
import scalikejdbc._
import services.observability.IngestionEventType.IngestionEventType
import org.postgresql.util.PSQLException
import scala.util.{Failure, Success, Try}
import akka.http.scaladsl.model.headers.LinkParams
import akka.event.Logging
import utils.Logging


class PostgresClient(url: String, user: String, password: String) extends Logging {
	// initialize JDBC driver & connection pool
	Class.forName("org.postgresql.Driver")
	ConnectionPool.singleton(url, user, password)
	implicit val session: AutoSession.type = AutoSession

	import Details.detailsFormat
	def insertRow (event: IngestionEvent): Boolean = {
		Try {
			val detailsJson = event.details.map(Json.toJson(_).toString).getOrElse("{}")
			sql"""
			INSERT INTO ingestion_events (
				blob_id,
				ingest_uri,
				type,
				status,
				details,
				created_at
			) VALUES (
				${event.blobId},
				${event.ingestUri},
				${event.eventType.toString()},
				${event.status.toString()},
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
					blobId: ${event.blobId}, ingestUri: ${event.ingestUri} eventType: ${event.eventType.toString()}
					exception: ${exception.getMessage()}"""
				)
				false
			}
		}
	}
}