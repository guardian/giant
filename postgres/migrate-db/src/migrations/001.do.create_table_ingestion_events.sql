CREATE TABLE ingestion_events (
	blob_id TEXT,
	ingest_id TEXT,
	"type" TEXT NOT NULL,
	status TEXT NOT NULL,
	details JSONB,
    event_time TIMESTAMP NOT NULL
);

CREATE TABLE blob_metadata (
	blob_id TEXT PRIMARY KEY,
	file_name TEXT,
	file_size INT,
	path TEXT
);