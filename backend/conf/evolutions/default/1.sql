CREATE EXTENSION "uuid-ossp";

CREATE TABLE collections (

);

CREATE TABLE ingestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL
);

CREATE TABLE tasks ( 

);

CREATE INDEX tasks_pending ON tasks ( -- ?? )

CREATE TABLE inode (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    ingestion_id UUID REFERENCES ingestions ON DELETE CASCADE NOT NULL,

    name TEXT NOT NULL,
    path TEXT NOT NULL -- denormalized path, constructed
);

CREATE TABLE blobs (
    id TEXT PRIMARY KEY,
);

CREATE TABLE blob_inodes (
    blob_id TEXT REFERENCES blobs ON DELETE CASACDE NOT NULL,
    inode_id UUID REFERENCES inodes ON DELETE CASACDE NOT NULL
);

-- A table that stores all the links
CREATE TABLE closure_table (

);