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
	def insertRow (blobId: String, ingestUri: String, eventType: IngestionEvent, details: Details) = {
		Try {
			sql"""INSERT INTO ingestion_events (
				blob_id,
				ingest_uri,
				type,
				details,
				-- created_at
			) VALUES (
				$blobId,
				$ingestUri,
				${eventType.toString()},
				${Json.toJson(details).toString}::JSONB,
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