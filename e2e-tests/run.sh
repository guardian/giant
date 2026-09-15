#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_DIR="$PWD"
E2E_DIR="$REPO_DIR/e2e-tests"
ARTIFACTS="$E2E_DIR/reports/services"
mkdir -p "$ARTIFACTS"

# Each invocation owns its containers and volumes. Fixed E2E ports keep the
# configuration simple; concurrent runs on one host fail instead of sharing data.
COMPOSE=(docker compose -f "$E2E_DIR/docker-compose.yml" -p "giant-e2e-$$")
export E2E_RUNTIME_DIR
E2E_RUNTIME_DIR=$(mktemp -d)
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  local result=$?
  trap - EXIT
  set +e
  for pid in "$FRONTEND_PID" "$BACKEND_PID"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
    fi
  done
  "${COMPOSE[@]}" logs --no-color > "$ARTIFACTS/services.log" 2>&1
  "${COMPOSE[@]}" down --volumes --remove-orphans
  rm -rf "$E2E_RUNTIME_DIR"
  if [[ "$result" != 0 ]]; then
    echo "E2E run failed. Logs: $ARTIFACTS" >&2
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Do not accidentally test an existing frontend or backend on these ports.
node <<'JS'
const net = require('node:net');
Promise.all([3100, 19001, 11234].map(port => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', () => reject(new Error(`E2E port ${port} is already in use`)));
  server.listen(port, () => server.close(resolve));
}))).catch(error => { console.error(error.message); process.exitCode = 1; });
JS

echo "Building the E2E backend..."
# Omit deployment JVM options (CloudWatch metrics, /var/log paths, default ports).
sbt -batch -J-Xmx2g 'set backend / Universal / javaOptions := Seq()' 'backend/stage' \
  > "$ARTIFACTS/build.log" 2>&1

echo "Starting disposable E2E services..."
"${COMPOSE[@]}" up -d --wait --wait-timeout 300
for bucket in ingest-data ingest-data-dead-letter data preview transcription-output-data remote-ingest-data; do
  "${COMPOSE[@]}" exec -T garage /garage bucket create "$bucket"
  "${COMPOSE[@]}" exec -T garage /garage bucket allow --read --write --owner --key garage-user "$bucket"
done > "$ARTIFACTS/buckets.log" 2>&1

npm ci --prefix infra/migrate-db > "$ARTIFACTS/migrations.log" 2>&1
npm --prefix infra/migrate-db run start -- DEV 18432 >> "$ARTIFACTS/migrations.log" 2>&1

# Reuse application defaults, but never load a developer's site.conf, which may
# contain database endpoints, cloud discovery, or authentication overrides.
sed '/^include "site.conf"$/d' backend/conf/application.conf > "$E2E_RUNTIME_DIR/application.conf"
cat "$E2E_DIR/setup/application.conf" >> "$E2E_RUNTIME_DIR/application.conf"
backend/target/universal/stage/bin/pfi \
  -J-Xms256m -J-Xmx2g \
  -Dconfig.file="$E2E_RUNTIME_DIR/application.conf" \
  -Dlogger.file="$E2E_DIR/setup/logback.xml" \
  -Dhttp.address=127.0.0.1 -Dhttp.port=19001 \
  -Dpidfile.path="$E2E_RUNTIME_DIR/backend.pid" \
  > "$ARTIFACTS/backend.log" 2>&1 &
BACKEND_PID=$!

wait_for_url() {
  local url=$1 pid=$2
  for ((attempt = 0; attempt < 120; attempt++)); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Process exited while waiting for $url" >&2
      return 1
    fi
    if curl --silent --fail --max-time 2 "$url" > /dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  return 1
}
wait_for_url http://127.0.0.1:19001/healthcheck "$BACKEND_PID"

(
  cd frontend
  exec node node_modules/vite/bin/vite.js --config "$E2E_DIR/vite.config.mts"
) > "$ARTIFACTS/frontend.log" 2>&1 &
FRONTEND_PID=$!
wait_for_url http://127.0.0.1:3100 "$FRONTEND_PID"

echo "Running Playwright against http://127.0.0.1:3100..."
cd "$E2E_DIR"
npm run test:run -- "$@"
