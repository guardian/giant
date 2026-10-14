# End-to-end tests

Giant uses the same approach as [flexible-restorer's E2E suite](https://github.com/guardian/flexible-restorer/tree/main/e2e-tests): Cucumber/Gherkin feature files, TypeScript step definitions and Playwright's browser runner, connected by `playwright-bdd`.

This standalone npm package owns the scenarios, test dependencies, browser configuration, Docker Compose stack, backend overrides, lifecycle script and reports. The GitHub Actions entry point remains in `.github/workflows/e2e.yml` and calls this package.

## Install and run

With Docker Compose 2.24.4 or later, Java, sbt and Node 24 installed, run from the repository root:

The external transcription and OCR scenarios need a sibling transcription-service checkout. Clone it if missing:

```sh
git clone --branch local-giant-support https://github.com/guardian/transcription-service.git ../transcription-service
```

Set `TRANSCRIPTION_SERVICE_DIR` to use a checkout elsewhere. The worker runs directly
on the host using that checkout's Node dependencies and `.venv`; an existing local
transcription-service setup can be reused. Ensure `ffmpeg`, Ghostscript, qpdf and Poppler utilities are on PATH. The worker uses `.venv/bin/ocrmypdf` with the RapidOCR plugin.

Install dependencies if needed and cache the public tiny model before running tests:

```sh
cd ../transcription-service
npm ci --ignore-scripts
uv venv --python 3.12
uv export --frozen --no-hashes --no-emit-project | sed '/^nvidia-/d; /^triton==/d' > /tmp/transcription-cpu-requirements.txt
uv pip sync --python .venv/bin/python --torch-backend cpu /tmp/transcription-cpu-requirements.txt
HF_HUB_DISABLE_IMPLICIT_TOKEN=1 .venv/bin/python -c 'from faster_whisper.utils import download_model; download_model("tiny")'
cd ../giant
```

Skip the environment installation commands if your worker is already set up. CI
installs the locked Python dependencies with CPU PyTorch wheels, following the same
commands, and checks out transcription-service's `local-giant-support` branch.

Then install the browser test dependencies:

```sh
npm ci --prefix frontend
npm ci --prefix e2e-tests
cd e2e-tests
npx playwright install --with-deps chromium
npm test
```

The workspace upload scenario also needs OCRmyPDF, Ghostscript, qpdf, Poppler utilities and English Tesseract data. On Ubuntu, install them with `sudo apt-get install -y ocrmypdf ghostscript qpdf poppler-utils tesseract-ocr-eng`.

`npm test` starts a fresh isolated Giant instance, generates Playwright tests from the feature files, runs them, and stops the instance and removes its volumes on exit. The same command runs in CI. No AWS or Hugging Face credentials or pre-existing account are required.

To run the audio scenario after the required genesis and internal PDF tests:

```sh
npm test -- --grep "Upload audio"
```

To run external OCR after those same internal tests:

```sh
npm test -- --grep "external OCR"
```

`npm test` always runs the internal phase first. Extra Playwright arguments select
external-phase tests; `--headed` and `--debug` also apply to the internal phase.

To monitor host processes and infrastructure containers in another terminal:

```sh
watch -n 1 'free -h; ps -eo pid,comm,%cpu,rss --sort=-rss | head -12'
```

Use `docker stats` for the infrastructure containers. The native worker appears in
host process monitoring. Reports and logs are written to `reports/`.

To start fresh test infrastructure and open Playwright UI mode:

```sh
npm run test:ui
```

Open http://localhost:9423 to select tests, run them, and inspect each action. In a dev container, forward port 9423 to your machine. The infrastructure stays running until you stop the terminal command with Ctrl+C, which removes the test containers and volumes.

UI mode runs genesis and the internal PDF test headlessly, restarts Giant, and then opens the external project in Playwright UI. The account already exists, so run the external scenarios there. Restart `npm run test:ui` to reset the databases and repeat both phases.

`npm test` runs headlessly, including in CI. To watch the browser or use Playwright Inspector instead:

```sh
npm test -- --headed
npm test -- --debug
```

List scenarios or type-check steps without starting the stack:

```sh
npm run test:list
npm run typecheck
```

`npm run test:run -- --project=internal --headed` runs the internal scenarios against an already-started instance. To run external scenarios against an existing account and an externally configured instance, use `npm run test:run -- --project=external --no-deps --headed`. These commands do not start, restart or reset Giant. Normally use `npm test` for the complete lifecycle.

## Writing scenarios

- `features/*.feature` describes behavior using Given/When/Then steps.
- `steps/*.steps.ts` implements those steps using Playwright locators and assertions.
- `fixtures.ts` exports the extended Playwright `test` and manages the independent browser session used to verify login. Each step file builds its own bindings with `createBdd(test)`.
- `playwright.config.ts` connects the features and steps with `defineBddConfig` and configures reporting.
- `vite.config.mts` reuses the frontend's Vite configuration with separate E2E ports and backend proxy settings.

`bddgen` generates `.features-gen/` automatically before each run. Edit features and step definitions, not the generated tests. Undefined steps fail generation.

The genesis scenario creates the first account through the UI, skips optional 2FA, then logs in from a fresh browser session and verifies administrator access. The `internal` project depends explicitly on the `genesis` project so the account exists before other scenarios run. One worker and no retries keep the fresh-instance requirement explicit.

The workspace upload scenario logs in with that account, creates a workspace, uploads `fixtures/toast_sandwich_en_wiki.pdf`, and waits for successful extraction. It checks the document icon and `processed` status so an extraction failure cannot count as success.

The internal phase runs this PDF test with both external-extractor flags disabled.
After it passes, the runner stops Giant, enables `worker.useExternalExtractors` and
`worker.useExternalOcrExtractor` using `setup/external.conf`, and restarts Giant against
the same databases and buckets. LocalStack and the native worker start for this second
phase. Genesis and the internal tests are not rerun.

The frontend, databases and a shared Chromium browser process stay running across
the switch. Each scenario still gets a fresh browser context for session isolation.
Both Playwright phases connect to the same browser server; it closes at final cleanup.

`features/external-extractors.feature` contains audio transcription and external OCR.
The OCR scenario uploads `fixtures/lifes_a_riot_with_spy_vs_spy_en.pdf` and uses the same
successful-processing assertion as the internal PDF scenario. Different PDFs avoid
reusing an already-ingested blob or relying on reprocessing during the config switch.

The audio scenario uploads `fixtures/sample.wav`, copied unchanged from
`transcription-service/packages/worker/sample-media/sample.wav` at commit
`a3623f9fa671e01037c68df7be4b285522eb8a30`. It waits for successful extraction and
opens the file to assert that a non-empty transcript is displayed. The real worker
consumes the SQS task, runs WhisperX on CPU, uploads the transcript to Garage, and
sends the completion message back to Giant. SHAKIRA_MODE is disabled.

Speaker diarization is disabled via `transcribe.diarize = false` to avoid a gated-model
token. Normal Giant jobs request diarization by default. A temporary CLI wrapper
selects CPU execution, one inference thread and batch size 1 for the E2E worker.
OCRmyPDF is limited to one job and RapidOCR/ONNX to one thread using a temporary copy of the worker's DEV config. The runner also limits BLAS/OpenMP threads. It uses the cached model, with Hugging
Face network access disabled at runtime. The worker has no container or hard memory
limit and is stopped along with the other host processes when the suite exits.

## IDE setup (IntelliJ IDEA)

Gherkin steps only resolve to the TypeScript step definitions when both plugins are installed:

- **Gherkin** — feature file syntax.
- **Cucumber.js** (`org.jetbrains.plugins.cucumber.javascript`) — resolves `Given/When/Then` in `.ts` files.

After installing, run `npm ci --prefix e2e-tests` so `node_modules` exists, then File | Invalidate Caches / Restart if steps are still unresolved. If steps in a new file do not resolve, define them via `createBdd(test)` in that file, as `steps/genesis.steps.ts` does, rather than importing `Given/When/Then` from another module.

## Infrastructure and isolation

`run.mts` runs directly with Node, using `zx` for shell commands and process cleanup. It builds the backend once, starts fresh Neo4j, PostgreSQL, Elasticsearch and Garage containers, creates buckets, runs migrations, and starts Giant and Vite for internal tests. It then adds LocalStack and the native worker and restarts only Giant for the external tests. It reuses application and Garage defaults but excludes the developer's `backend/conf/site.conf`.

`docker-compose.yml` extends the root Compose services so image versions and shared settings stay in one place. It replaces published ports and clears fixed container names to keep the test stack isolated.

E2E ports: frontend 3100, backend 19001, cluster 11234, Neo4j 17687, PostgreSQL 18432, Elasticsearch 19200, Garage 13900 and LocalStack 14566. Development containers and volumes are not used. Each invocation owns a unique Compose project and removes only its own volumes, including after failures. Run one E2E suite at a time on a host.

`setup/application.conf` disables external extractors and uses a one-second polling
interval. `setup/external.conf` enables external transcription and OCR for the second phase. `setup/init-transcription.py` creates queues and
disposable SSM parameters in LocalStack. The worker uses a credentials file
containing LocalStack dummy credentials and directs SSM requests to LocalStack.
Audio is transferred using Giant's signed Garage URLs. No real AWS configuration is
read or changed. CI installs the PDF extraction tools used by the upload fixture.

## Reports

All output is ignored by Git under `reports/`:

- `internal/cucumber/index.html` and `external/cucumber/index.html`: scenarios and step results for each phase.
- `internal/playwright/index.html` and `external/playwright/index.html`: each phase's Playwright report.
- `internal/test-results/` and `external/test-results/`: failure screenshots and traces.
- `services/`: backend build, `backend-internal.log`, `backend-external.log`, native worker, migration and infrastructure logs.

Open the Playwright report with `npx playwright show-report reports/external/playwright`, or a failure trace with `npx playwright show-trace <path-to-trace.zip>`. CI uploads `reports/` even if the run fails.
