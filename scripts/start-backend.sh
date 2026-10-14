#!/usr/bin/env bash
set -euo pipefail
SCRIPTPATH=$(cd "$(dirname "$0")" && pwd -P)
cd "$SCRIPTPATH/.."

EXTERNAL=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --external) EXTERNAL=true; shift ;;
        --help|-h)
            echo "Usage: $0 [--external]"
            exit 0
            ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
done

if [[ ! -f "$SCRIPTPATH/../backend/conf/site.conf" ]]; then
    echo "You do not have a site config, please run scripts/cluster-setup.sh" >&2
    exit 1
fi

AVAILABLE_MEMORY=$(docker stats --no-stream --format "{{.MemUsage}}" | awk 'NR==1 {print int($3)}')

# This is a threshold of 5 GiB, about 5.4 GB.
# elasticsearch wants 4 GiB (https://www.elastic.co/guide/en/elasticsearch/reference/current/docker.html)
# and we leave some headroom for neo4j and garage.
if [[ $AVAILABLE_MEMORY -lt 5 ]]; then
    echo "For elasticsearch to run within a Docker container, you must give Docker \
    at least 6GB of memory from the Preferences menu. If running in a dev container, you'll need 16GB per dev container 😱"
    exit 1
fi

./scripts/start-containers.sh
echo "setting useExternalExtractors to ${EXTERNAL}"
SBT_ARGS=()
if [[ "$EXTERNAL" == true ]]; then
    SBT_ARGS=(-Dworker.useExternalExtractors=true -Dworker.useExternalOcrExtractor=true)
    export LOCALSTACK_PORT=${LOCALSTACK_PORT:-4567}
    docker compose --profile external up -d --wait --wait-timeout 120 localstack

    # Give the worker its own process group so npm, uv and their children are
#    # stopped along with the backend, including when the user presses Ctrl-C.
#    set -m
#    "$SCRIPTPATH/start-external-worker.sh" &
#    EXTERNAL_WORKER_PID=$!
#    set +m
#    cleanup() {
#        kill -TERM -- "-$EXTERNAL_WORKER_PID" 2>/dev/null || true
#        wait "$EXTERNAL_WORKER_PID" 2>/dev/null || true
#    }
#    trap cleanup EXIT
#    trap 'exit 130' INT
#    trap 'exit 143' TERM
fi

sbt "${SBT_ARGS[@]}" backend/run -mem 4096 -jvm-debug 5005
