CREATE TABLE remote_ingest (
	id TEXT PRIMARY KEY NOT NULL,
	title TEXT NOT NULL,
	status TEXT NOT NULL,
    collection TEXT NOT NULL,
    ingestion TEXT NOT NULL,
	workspace_id TEXT NOT NULL,
    workspace_node_id TEXT NOT NULL,
	parent_folder_id TEXT,
	timeout_at TIMESTAMPTZ,
    user_email TEXT,
    url TEXT
);
