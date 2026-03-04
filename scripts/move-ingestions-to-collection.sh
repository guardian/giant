#!/usr/bin/env bash
#
# move-ingestions-to-collection.sh
#
# Moves ingestions listed in input.json a collection.
# input.json should be an array of objects with a "uri" field, e.g.:
# [
#   { "uri": "/resources/ingestion1" },
#   { "uri": "/resources/ingestion2" }
# ]
#
# Prerequisites:
#   - jq installed (brew install jq)
#   - Authenticated session token for giant (admin user)
#
# Usage:
#   ./move-ingestions-to-collection.sh <giant-base-url> <token-header-value> <path-to-json> <target-collection>
#
# Example:
#   ./move-ingestions-to-collection.sh \
#     "https://giant.example.com" \
#     "abc123" \
#     input.json \
#     "target_collection_name"

set -euo pipefail

BASE_URL="${1:?Usage: $0 <base-url> <token> <json-file> <target-collection>}"
BASE_URL="${BASE_URL%/}"  # Strip trailing slash if present
TOKEN="${2:?Usage: $0 <base-url> <token> <json-file> <target-collection>}"
JSON_FILE="${3:?Usage: $0 <base-url> <token> <json-file> <target-collection>}"
TARGET_COLLECTION="${4:?Usage: $0 <base-url> <token> <json-file> <target-collection>}"

ENDPOINT="${BASE_URL}/api/collections/ingestion/move-ingestion"

# Extract URIs from JSON array, strip /resources/ prefix, and URL-decode
INGESTION_URIS=$(jq -r '.[] | .uri | sub("^/resources/"; "")' "$JSON_FILE" | perl -pe 's/%([0-9A-Fa-f]{2})/chr(hex($1))/eg')

TOTAL=$(echo "$INGESTION_URIS" | wc -l | tr -d ' ')
echo "Found ${TOTAL} ingestions to move to '${TARGET_COLLECTION}'"
echo "Endpoint: ${ENDPOINT}"
echo ""

INDEX=0

while IFS= read -r uri; do
  ((INDEX++))
  echo -n "[${INDEX}/${TOTAL}] Moving: ${uri} ... "

  HTTP_CODE=$(curl -s -o /tmp/giant-move-response.json -w "%{http_code}" \
    -X PUT \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"ingestionUri\": \"${uri}\", \"targetCollection\": \"${TARGET_COLLECTION}\"}" \
    "${ENDPOINT}")

  if [[ "$HTTP_CODE" == "200" ]]; then
    NEW_URI=$(jq -r '.newUri' /tmp/giant-move-response.json)
    echo "OK -> ${NEW_URI}"
  else
    BODY=$(cat /tmp/giant-move-response.json)
    echo "FAILED (HTTP ${HTTP_CODE}): ${BODY}"
    exit 1
  fi

  # Small delay to avoid overwhelming the server
  sleep 0.5
done <<< "$INGESTION_URIS"
