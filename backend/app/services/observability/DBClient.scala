package services.observability
import scalikejdbc._


class DBClient (url: String, user: String, password: String) {
	// initialize JDBC driver & connection pool
	Class.forName("org.postgresql.Driver")
	ConnectionPool.singleton(url, user, password)
	implicit val session = AutoSession

	def insertRow () = {
		// val a = sql"select * from ingestion_events".map(_.toMap()).list().apply()
		sql"""insert INTO ingestion_events (
			id,
			blob_id,
			"type",
			details,
			created_at
		) VALUES (
			'663f8dd6-7c3f-4ea3-861c-6515b84f3fc3',
			'asldjfasldkjg',
			'CREATED',
			'{}'::jsonb,
			now()
		);""".update().apply()
	}
}