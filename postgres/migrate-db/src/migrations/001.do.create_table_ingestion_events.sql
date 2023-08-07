CREATE TABLE ingestion_events (
	id UUID NOT NULL,
	blob_id TEXT,
	"type" TEXT NOT NULL,
	details JSONB,
	created_at TIMESTAMP NOT NULL
);