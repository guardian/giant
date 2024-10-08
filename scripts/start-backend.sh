#!/usr/bin/env bash
SCRIPTPATH=$( cd $(dirname $0) ; pwd -P )


ARCHITECTURE=$(uname -m)

if [ "$ARCHITECTURE" != "arm64" ]; then
  echo "Running on x86 architecture - using standard neo4j image image."
  export NEO4J_IMAGE_OVERRIDE=neo4j:3.4.0
fi

if (! docker stats --no-stream 1>/dev/null 2>&1); then
  echo "Starting docker..."
  # On Mac OS this would be the terminal command to launch Docker
  open /Applications/Docker.app
  # Wait until Docker daemon is running and has completed initialisation
  while (! docker stats --no-stream 1>/dev/null 2>&1); do
    # Docker takes a few seconds to initialize
    echo "Docker not initialised yet, waiting 1 second..."
    sleep 1
  done
  echo "Docker started!"
fi

docker compose up -d

AVAILABLE_MEMORY=$( docker stats --format "{{.MemUsage}}" --no-stream \
| head -1 \
| egrep -o "\/ \d+\.\d+GiB" | egrep -o "\d+" \
| head -1)

# This is a threshold of 5 GiB, about 5.4 GB.
# elasticsearch wants 4 GiB (https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html)
# and we leave some headroom for neo4j and minio.
if [ $AVAILABLE_MEMORY -lt 5 ]; then
    echo "For elasticsearch to run within a Docker container, you must give Docker \
    at least 6GB of memory from the Preferences menu."
    exit 1
fi

if [ ! -f "$SCRIPTPATH/../backend/conf/site.conf" ]; then
    echo "You do not have a site config, please run scripts/cluster-setup.sh" >&2
    exit 1
fi

sbt backend/run -mem 4096 -jvm-debug 5005
