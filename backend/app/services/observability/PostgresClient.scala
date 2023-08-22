package services.observability
import org.joda.time.{DateTime, DateTimeZone}
import play.api.libs.json.Json
import scalikejdbc._
import services.PostgresConfig

import scala.util.{Failure, Success, Try}
import utils.Logging
import utils.attempt.{PostgresReadFailure, PostgresWriteFailure, Failure => GiantFailure}

trait PostgresClient {
	def insertEvent(event: IngestionEvent): Either[GiantFailure, Unit]
	def insertMetaData(metaData: BlobMetaData): Either[GiantFailure, Unit]
	def getEvents (ingestId: String, ingestIdIsPrefix: Boolean): Either[GiantFailure, List[BlobStatus]]
}

class PostgresClientDoNothing extends PostgresClient {
	override def insertEvent(event: IngestionEvent): Either[GiantFailure, Unit] = Right(())

	override def insertMetaData(metaData: BlobMetaData): Either[GiantFailure, Unit] = Right(())

	override def getEvents (ingestId: String, ingestIdIsPrefix: Boolean): Either[GiantFailure, List[BlobStatus]] = Right(List())
}

class PostgresClientImpl(postgresConfig: PostgresConfig) extends PostgresClient with Logging {
	val dbHost = s"jdbc:postgresql://${postgresConfig.host}:${postgresConfig.port}/giant"
	// initialize JDBC driver & connection pool
	Class.forName("org.postgresql.Driver")
	ConnectionPool.singleton(dbHost, postgresConfig.username, postgresConfig.password)
	implicit val session: AutoSession.type = AutoSession

	import EventDetails.detailsFormat

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
              exception: ${exception.getMessage()}""", exception
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

	def getEvents(ingestId: String, ingestIdIsPrefix: Boolean): Either[PostgresReadFailure, List[BlobStatus]] = {
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
        -- get all the extractors expected for a given blob
         SELECT ingest_id, blob_id, jsonb_array_elements_text(details -> 'extractors') as extractor from ingestion_events
         WHERE ingest_id LIKE ${if(ingestIdIsPrefix) LikeConditionEscapeUtil.beginsWith(ingestId) else ingestId} AND
         type = ${IngestionEventType.MimeTypeDetected.toString}
    		),
				extractor_statuses as (
          -- Aggregate all the status updates for the relevant extractors for a given blob
					SELECT
						blob_extractors.blob_id,
						blob_extractors.extractor,
            -- As the same status update may happen multiple times if a blob is reingested, it's useful to have the time
						ARRAY_AGG(EXTRACT(EPOCH from ingestion_events.event_time)) AS extractor_event_times,
						ARRAY_AGG(ingestion_events.status) AS extractor_event_statuses
				 	FROM blob_extractors
				 	LEFT JOIN ingestion_events
					ON blob_extractors.blob_id = ingestion_events.blob_id
					AND blob_extractors.ingest_id = ingestion_events.ingest_id
					AND blob_extractors.extractor = ingestion_events.details ->> 'extractorName'
          -- A file may be uploaded multiple times within different ingests - use group by to merge them together
          GROUP BY 1,2
				)
				SELECT
					ie.blob_id,
					ie.ingest_id,
					ie.ingest_start,
					ie.most_recent_event,
					ie.errors,
     		  ie.workspace_name AS "workspaceName",
          ARRAY_AGG(DISTINCT blob_metadata.path ) AS paths,
     		  (ARRAY_AGG(blob_metadata.file_size))[1] as "fileSize",
					ARRAY_AGG(extractor_statuses.extractor) AS extractors,
          -- You can't array_agg arrays of varying cardinality so here we convert to string
					ARRAY_AGG(ARRAY_TO_STRING(extractor_statuses.extractor_event_times, ',','null')) AS "extractorEventTimes",
					ARRAY_AGG(ARRAY_TO_STRING(extractor_statuses.extractor_event_statuses, ',','null')) AS "extractorStatuses"
				FROM (
					SELECT
						blob_id,
						ingest_id,
						MIN(event_time) AS ingest_start,
						Max(event_time) AS most_recent_event,
						ARRAY_AGG(details -> 'errors') as errors,
            (ARRAY_AGG(details ->> 'workspaceName'))[1] AS workspace_name
						FROM ingestion_events
						WHERE ingest_id LIKE ${if(ingestIdIsPrefix) LikeConditionEscapeUtil.beginsWith(ingestId) else ingestId}
						GROUP BY 1,2
					) AS ie
     		LEFT JOIN blob_metadata USING(ingest_id, blob_id)
				LEFT JOIN extractor_statuses USING(blob_id)
				GROUP BY 1,2,3,4,5,6
     """.map(rs => {
				BlobStatus(
					EventMetaData(
						rs.string("blob_id"),
						rs.string("ingest_id")
					),
					rs.array("paths").getArray().asInstanceOf[Array[String]].toList,
					rs.long("fileSize"),
					rs.stringOpt("workspaceName"),
					new DateTime(rs.dateTime("ingest_start").toInstant.toEpochMilli, DateTimeZone.UTC),
					new DateTime(rs.dateTime("most_recent_event").toInstant.toEpochMilli, DateTimeZone.UTC),
					rs.arrayOpt("extractors").map { extractors =>
						ExtractorStatus.parseDbStatusEvents(
							extractors.getArray().asInstanceOf[Array[String]],
							rs.array("extractorEventTimes").getArray().asInstanceOf[Array[String]],
							rs.array("extractorStatuses").getArray().asInstanceOf[Array[String]]
						)
					}.getOrElse(List()),
					List() // need to implement this - something like: rs.array("errors").getArray.asInstanceOf[Array[String]].map(e => Json.parse(e).as[IngestionError]).toList
				)
			}
			).list().apply()
			results
		}
		match {
			case Success(results) => Right(results)
			case Failure(exception) => Left(PostgresReadFailure(exception, "getEvents"))
		}
	}
}
