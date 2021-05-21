#!/usr/bin/env bash

# Neo4jTestService.scala uses the same query to wipe data between tests.
# Ideally the two should stay in sync.
query='{"query": "MATCH (c:Collection)<-[:PARENT]-(i: Ingestion { default: true}) MATCH (n) WHERE NOT n:User AND NOT n:Permission AND NOT n = c AND NOT n = i DETACH DELETE n" }'

curl                                                  \
     -H'Content-Type: application/json'               \
     -H'Accept:application/json; charset=UTF-8'       \
     -XPOST -d"$query"                                \
     "http://neo4j:bob@localhost:7474/db/data/cypher" 2>&1 > /dev/null

# ElasticsearchTestService.scala uses the same query to wipe data between tests.
# Ideally the two should stay in sync.
curl                                                  \
     -XPOST                                         \
     "localhost:9200/_all/_delete_by_query?q=*" 2>&1 > /dev/null


if [ -d ../minio-data ]; then
    rm -r ../minio-data
fi
