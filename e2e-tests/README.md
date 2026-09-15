# End-to-end tests

Giant uses the same approach as [flexible-restorer's E2E suite](https://github.com/guardian/flexible-restorer/tree/main/e2e-tests): Cucumber/Gherkin feature files, TypeScript step definitions and Playwright's browser runner, connected by `playwright-bdd`.

This standalone npm package owns the scenarios, test dependencies, browser configuration, Docker Compose stack, backend overrides, lifecycle script and reports. The GitHub Actions entry point remains in `.github/workflows/e2e.yml` and calls this package.

## Install and run

With Docker Compose 2.24.4 or later, Java, sbt and Node installed, run from the repository root:

```sh
npm ci --prefix frontend
npm ci --prefix e2e-tests
cd e2e-tests
npx playwright install --with-deps chromium
npm test
```

`npm test` starts a fresh isolated Giant instance, generates Playwright tests from the feature files, runs them, and stops the instance and removes its volumes on exit. The same command runs in CI. No AWS credentials or pre-existing account are required.

To watch or debug the scenario:

```sh
npm test -- --headed
npm test -- --debug
```

List scenarios or type-check steps without starting the stack:

```sh
npm run test:list
npm run typecheck
```

`npm run test:run -- --headed` generates and runs the scenarios against an instance you have already started on the E2E ports. It does not create or reset that instance. Normally use `npm test` to guarantee the empty user store required by genesis.

## Writing scenarios

- `features/*.feature` describes behavior using Given/When/Then steps.
- `steps/*.steps.ts` implements those steps using Playwright locators and assertions.
- `fixtures.ts` exports the step functions and manages the independent browser session used to verify login.
- `playwright.config.ts` connects the features and steps with `defineBddConfig` and configures reporting.
- `vite.config.mts` reuses the frontend's Vite configuration with separate E2E ports and backend proxy settings.

`bddgen` generates `.features-gen/` automatically before each run. Edit features and step definitions, not the generated tests. Undefined steps fail generation.

The genesis scenario creates the first account through the UI, skips optional 2FA, then logs in from a fresh browser session and verifies administrator access. One worker and no retries keep the fresh-instance requirement explicit. Additional scenarios that require genesis will need an explicit setup dependency or their own provisioning; do not rely on feature file order.

## Infrastructure and isolation

`run.sh` builds a packaged backend, starts fresh Neo4j, PostgreSQL, Elasticsearch and Garage containers, creates storage buckets, runs PostgreSQL migrations, and starts the backend and Vite. It reuses the application's default configuration and Garage configuration but excludes the developer's `backend/conf/site.conf`.

`docker-compose.yml` extends the root Compose services so image versions and shared settings stay in one place. It replaces published ports and clears fixed container names to keep the test stack isolated.

E2E ports: frontend 3100, backend 19001, cluster 11234, Neo4j 17687, PostgreSQL 18432, Elasticsearch 19200 and Garage 13900. Development containers and volumes are not used. Each invocation owns a unique Compose project and removes only its own volumes, including after failures. Run one E2E suite at a time on a host.

`setup/application.conf` disables background workers and external extractors for this genesis-only suite. Before adding upload/extraction coverage, enable the required local workers and install the extraction tools exercised by the fixtures in CI.

## Reports

All output is ignored by Git under `reports/`:

- `cucumber/index.html`: human-readable scenarios and their step results.
- `playwright/index.html`: Playwright's test report.
- `test-results/`: failure screenshots and traces.
- `services/`: backend build, application, migration and Docker logs.

Open the Playwright report with `npx playwright show-report reports/playwright`, or a failure trace with `npx playwright show-trace <path-to-trace.zip>`. CI uploads `reports/` even if the run fails.
