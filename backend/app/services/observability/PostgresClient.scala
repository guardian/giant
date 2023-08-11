package services.observability
import play.api.libs.json.Json
import scalikejdbc._

import scala.util.{Failure, Success, Try}
import utils.Logging
import utils.attempt.PostgresWriteFailure
import utils.attempt.{Failure => GiantFailure}


class PostgresClient(url: String, user: String, password: String) extends Logging {
	// initialize JDBC driver & connection pool
	Class.forName("org.postgresql.Driver")
	ConnectionPool.singleton(url, user, password)
	implicit val session: AutoSession.type = AutoSession

	import Details.detailsFormat
	def insertRow (event: IngestionEvent): Either[GiantFailure, Unit] = {
		Try {
			val detailsJson = event.details.map(Json.toJson(_).toString).getOrElse("{}")
			sql"""
			INSERT INTO ingestion_events (
				blob_id,
				ingest_uri,
				type,
				status,
				details,
				event_time
			) VALUES (
				${event.metaData.blobId},
				${event.metaData.ingestUri},
				${event.eventType.toString()},
				${event.status.toString()},
				$detailsJson::JSONB,
				now()
			);""".execute().apply()
		} match {
			case Success(_) => {
				Right(())
			}
			case Failure(exception) => {
				logger.error(s"""
					An exception ocurred while inserting ingestion event
					blobId: ${event.metaData.blobId}, ingestUri: ${event.metaData.ingestUri} eventType: ${event.eventType.toString()}
					exception: ${exception.getMessage()}"""
				)
				Left(PostgresWriteFailure(exception))
			}
		}
	}
}