# End-to-end tests

From the repository root, with Docker Compose, Java, sbt and Node installed:

```sh
npm ci --prefix frontend
cd frontend
npx playwright install --with-deps chromium
cd ..
./scripts/test-e2e.sh
```

Use `./scripts/test-e2e.sh --headed` to watch the browser locally.

The script builds a packaged backend, starts fresh Neo4j, PostgreSQL,
Elasticsearch and Garage containers, creates storage buckets, runs PostgreSQL
migrations, starts the backend and Vite, then runs Playwright. GitHub Actions runs
the same script. No AWS credentials or pre-existing Giant account are needed.

The single test creates the genesis user through the UI, skips optional 2FA,
then logs in from a fresh browser context and checks administrator access.
Retries are disabled because genesis requires an empty user store. Rerun the
script to get a fresh instance; running Playwright alone does not reset anything.

The E2E frontend uses port 3100, backend 19001, cluster 11234, Neo4j 17687,
PostgreSQL 18432, Elasticsearch 19200 and Garage 13900. Development containers,
volumes and `backend/conf/site.conf` are not used. Each run has a unique Compose
project name and removes its own volumes on exit, including after test failures.
Run only one E2E suite at a time on a host.

Logs are saved in `frontend/e2e-artifacts/`, the HTML report in
`frontend/playwright-report/`, and failure traces/screenshots in
`frontend/test-results/`. CI uploads these even when a run fails.

Background workers are disabled for this genesis-only suite. Before adding
upload/extraction coverage, enable the required workers in `backend/conf/e2e.conf`
and install the extraction tools exercised by the fixtures in CI.
