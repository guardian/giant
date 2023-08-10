CREATE TABLE ingestion_events (
	blob_id TEXT,
	ingest_uri TEXT,
	"type" TEXT NOT NULL,
	status TEXT NOT NULL,
	details JSONB,
	created_at TIMESTAMP NOT NULL
);
CREATE TABLE blob_metadata (
	blob_id TEXT PRIMARY KEY,
	file_name TEXT,
	path TEXT
);