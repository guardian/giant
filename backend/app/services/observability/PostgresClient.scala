package services.observability
import org.joda.time.{DateTime, DateTimeZone}
import play.api.libs.json.Json
import scalikejdbc._

import scala.util.{Failure, Success, Try}
import utils.Logging
import utils.attempt.{PostgresReadFailure, PostgresWriteFailure, Failure => GiantFailure}

trait PostgresClient {
	def insertEvent(event: IngestionEvent): Either[GiantFailure, Unit]
	def insertMetaData(metaData: BlobMetaData): Either[GiantFailure, Unit]
	def getEvents (ingestionUri: String): Either[GiantFailure, List[BlobStatus]]
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
				ingest_id,
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

	def getEvents(ingestionUri: String): Either[PostgresReadFailure, List[BlobStatus]] = {
		Try {
			/**
				* The aim of this query is to merge ingestion events for each blob into a single row, containing the success/failure
				* status of each extractor that was expected to run on the ingestion.
				*
				* The subqueries are as follows:
				* 	blob_extractors - get the extractors expected to run for each blob
				*   extractor_statuses - get the success/failure status for the extractors identified in blob_extractors
				*
				*/
			val results = sql"""
        WITH blob_extractors AS (
         SELECT blob_id, jsonb_array_elements_text(details -> 'extractors') as extractor from ingestion_events
         WHERE ingest_id = ${ingestionUri} AND
         type = ${IngestionEventType.MimeTypeDetected.toString}
    		),
				extractor_statuses as (
					SELECT blob_extractors.blob_id, blob_extractors.extractor, ingestion_events.status
				 	FROM blob_extractors
				 	LEFT JOIN ingestion_events
					ON blob_extractors.blob_id = ingestion_events.blob_id
					AND blob_extractors.extractor = ingestion_events.details ->> 'extractorName'
				)
				SELECT
					blob_id,
					ingest_id,
					ingest_start,
					most_recent_event,
					errors,
					ARRAY_AGG(extractor_statuses.extractor) AS extractors,
					ARRAY_AGG(extractor_statuses.status) AS statuses
				FROM (
					SELECT
						blob_id,
						ingest_id,
						MIN(event_time) AS ingest_start,
						Max(event_time) AS most_recent_event,
						ARRAY_AGG(details -> 'errors') as errors
						FROM ingestion_events
						WHERE ingest_id = ${ingestionUri}
						GROUP BY 1,2
					) AS ie
				LEFT JOIN extractor_statuses USING(blob_id)
				GROUP BY 1,2,3,4,5
     """.map(rs => {
				BlobStatus(
					MetaData(
						rs.string("blob_id"),
						rs.string("ingest_id")
					),
					"unknown",
					new DateTime(rs.dateTime("ingest_start").toInstant.toEpochMilli, DateTimeZone.UTC),
					new DateTime(rs.dateTime("most_recent_event").toInstant.toEpochMilli, DateTimeZone.UTC),
					rs.arrayOpt("extractors").map{extractors =>
						val extractorArray = extractors.getArray().asInstanceOf[Array[String]].map(s => ExtractorType.withName(s))
						// assume that if extractors is defined then statuses should be (.array instead of .arrayOpt)
						val statusArray = rs.array("statuses").getArray().asInstanceOf[Array[String]].map(s => Status.withName(s))
						extractorArray.zip(statusArray).toList
					}.getOrElse(List()),
					List() // need to implement this - something like: rs.array("errors").getArray.asInstanceOf[Array[String]].map(e => Json.parse(e).as[IngestionError]).toList
				)
			}
			).list().apply()
			println(results)
			results
		}
		match {
			case Success(results) => Right(results)
			case Failure(exception) => Left(PostgresReadFailure(exception, "getEvents"))
		}
	}
}
