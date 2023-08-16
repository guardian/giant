CREATE TABLE ingestion_events (
	ingest_id TEXT NOT NULL,
	blob_id TEXT NOT NULL,
	"type" TEXT NOT NULL,
	status TEXT NOT NULL,
	details JSONB,
	event_time TIMESTAMP NOT NULL
);
CREATE TABLE blob_metadata (
	ingest_id TEXT NOT NULL,
	blob_id TEXT NOT NULL,
	path TEXT NOT NULL, -- includes file name
	file_size BIGINT NOT NULL,
	insert_time TIMESTAMP NOT NULL
);
CREATE INDEX ON ingestion_events (ingest_id, blob_id);
CREATE INDEX ON blob_metadata (ingest_id, blob_id);
CREATE INDEX ON ingestion_events ("type");
CREATE INDEX ON ingestion_events ((details->>'extractorName'));
-- TODO think about indexing details->>'extractors'
-- TODO think about indexing workspace