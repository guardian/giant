package services.observability
import play.api.libs.json.Json
import scalikejdbc._

import scala.util.{Failure, Success, Try}
import utils.Logging
import utils.attempt.PostgresWriteFailure
import utils.attempt.{Failure => GiantFailure}

trait PostgresClient {
	def insertEvent(event: IngestionEvent): Either[GiantFailure, Unit]
	def insertMetaData(metaData: BlobMetaData): Either[GiantFailure, Unit]
}
class PostgresClientImpl(url: String, user: String, password: String) extends PostgresClient with Logging {
	// initialize JDBC driver & connection pool
	Class.forName("org.postgresql.Driver")
	ConnectionPool.singleton(url, user, password)
	implicit val session: AutoSession.type = AutoSession

	import Details.detailsFormat

	def insertMetaData(metaData: BlobMetaData): Either[GiantFailure, Unit] = {
		Try {
			sql"""
			INSERT INTO blob_metadata (
				blob_id,
				file_name,
				file_size,
				path
			) VALUES (
				${metaData.blobId},
      	${metaData.fileName},
      	${metaData.fileSize},
      	${metaData.path}
			);""".execute().apply()
		} match {
			case Success(_) => Right(())
			case Failure(exception) =>
				logger.error(s"""
              An exception occurred while inserting blob metadata
              blobId: ${metaData.blobId}, fileName: ${metaData.fileName}, file_size: ${metaData.fileSize} path: ${metaData.path}
              exception: ${exception.getMessage()}"""
				)
				Left(PostgresWriteFailure(exception))
		}
	}
	def insertEvent(event: IngestionEvent): Either[GiantFailure, Unit] = {
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
			case Success(_) => Right(())
			case Failure(exception) =>
				logger.error(s"""
          An exception occurred while inserting ingestion event
          blobId: ${event.metaData.blobId}, ingestUri: ${event.metaData.ingestUri} eventType: ${event.eventType.toString()}
          exception: ${exception.getMessage()}"""
				)
				Left(PostgresWriteFailure(exception))
		}
	}
}