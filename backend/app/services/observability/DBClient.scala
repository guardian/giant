package services.observability
import play.api.libs.json.{Json}
import scalikejdbc._
import services.observability.IngestionEvent.IngestionEvent


class DBClient (url: String, user: String, password: String) {
	// initialize JDBC driver & connection pool
	Class.forName("org.postgresql.Driver")
	ConnectionPool.singleton(url, user, password)
	implicit val session = AutoSession

	import Details.detailsFormat
	def insertRow (blobId: String, ingestUri: String, eventType: IngestionEvent, details: Details) = {
		// val a = sql"select * from ingestion_events".map(_.toMap()).list().apply()
		println("inserting row: ")
		sql"""insert INTO ingestion_events (
			blob_id,
			"type",
			details,
			created_at
		) VALUES (
			$blobId,
			$ingestUri,
			$eventType,
			${Json.toJson(details).toString}::JSONB,
			now()
		);""".update().apply()
	}
}