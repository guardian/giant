package services.observability
import play.api.libs.json.Json
import scalikejdbc._
import services.PostgresConfig

import scala.util.{Failure, Success, Try}
import utils.Logging
import utils.attempt.PostgresWriteFailure
import utils.attempt.{Failure => GiantFailure}

trait PostgresClient {
	def insertEvent(event: IngestionEvent): Either[GiantFailure, Unit]
	def insertMetaData(metaData: BlobMetaData): Either[GiantFailure, Unit]
}

class PostgresClientDoNothing extends PostgresClient {
	override def insertEvent(event: IngestionEvent): Either[GiantFailure, Unit] = Right(())

	override def insertMetaData(metaData: BlobMetaData): Either[GiantFailure, Unit] = Right(())
}

class PostgresClientImpl(postgresConfig: PostgresConfig) extends PostgresClient with Logging {
	val dbHost = s"jdbc:postgresql://${postgresConfig.host}:${postgresConfig.port}/giant"
	// initialize JDBC driver & connection pool
	Class.forName("org.postgresql.Driver")
	ConnectionPool.singleton(dbHost, postgresConfig.username, postgresConfig.password)
	implicit val session: AutoSession.type = AutoSession

	import Details.detailsFormat

	def insertMetaData(metaData: BlobMetaData): Either[GiantFailure, Unit] = {
		Try {
			sql"""
			INSERT INTO blob_metadata (
			  ingest_id,
				blob_id,
				file_size,
				path,
			  insert_time
			) VALUES (
			  ${metaData.ingestId},
				${metaData.blobId},
      	${metaData.fileSize},
      	${metaData.path},
			  now()
			);""".execute().apply()
		} match {
			case Success(_) => Right(())
			case Failure(exception) =>
				logger.warn(s"""
              An exception occurred while inserting blob metadata
              blobId: ${metaData.blobId}, ingestId: ${metaData.ingestId} path: ${metaData.path}
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
				ingest_id,
				type,
				status,
				details,
				event_time
			) VALUES (
				${event.metaData.blobId},
				${event.metaData.ingestId},
				${event.eventType.toString()},
				${event.status.toString()},
				$detailsJson::JSONB,
				now()
			);""".execute().apply()
		} match {
			case Success(_) => Right(())
			case Failure(exception) =>
				logger.warn(s"""
          An exception occurred while inserting ingestion event
          blobId: ${event.metaData.blobId}, ingestId: ${event.metaData.ingestId} eventType: ${event.eventType.toString()}
          exception: ${exception.getMessage()}"""
				)
				Left(PostgresWriteFailure(exception))
		}
	}
}