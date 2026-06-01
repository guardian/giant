#!/usr/bin/env bash

for bucket in ingest-data ingest-data-dead-letter data preview transcription-output-data remote-ingest-data; do
  docker exec garage /garage bucket info $bucket >/dev/null 2>&1 || docker exec garage /garage bucket create $bucket
  docker exec garage /garage bucket allow --read --write --owner --key garage-user $bucket
done

echo "Garage buckets created (if they did not already exist) and permissions set."
