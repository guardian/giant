CREATE TABLE ingestion_events (
	blob_id TEXT,
	ingest_uri TEXT,
	"type" TEXT NOT NULL,
	details JSONB,
	created_at TIMESTAMP NOT NULL
);