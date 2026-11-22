import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type BrowserServer } from "@playwright/test";
import { $, ProcessOutput, type ProcessPromise } from "zx";

const e2eDir = import.meta.dirname;
const repoDir = resolve(e2eDir, "..");
const transcriptionDir = resolve(
  process.env.TRANSCRIPTION_SERVICE_DIR ||
    resolve(repoDir, "../transcription-service"),
);
const artifacts = resolve(e2eDir, "reports/services");
// Each run owns its containers and volumes; fixed ports prevent concurrent runs.
const compose = [
  "docker",
  "compose",
  "-f",
  resolve(e2eDir, "docker-compose.yml"),
  "-p",
  `giant-e2e-${process.pid}`,
];
const shell = $({ cwd: repoDir, verbose: false, stdio: "inherit" });
const commands: ProcessPromise[] = [];
let browserServer: BrowserServer | undefined;
const controller = new AbortController();
const { signal } = controller;

function run(parts: TemplateStringsArray, ...args: unknown[]) {
  signal.throwIfAborted();
  const command = shell(parts, ...args);
  commands.push(command);
  return command;
}

async function stopCommands() {
  await Promise.all(
    commands
      .filter((command) => command.stage === "running")
      .map((command) => command.kill()),
  );
  await Promise.allSettled(commands);
}

function interrupt(code: number) {
  process.exitCode = code;
  controller.abort();
  void stopCommands().catch(console.error);
}
process.on("SIGINT", () => interrupt(130));
process.on("SIGTERM", () => interrupt(143));

async function checkPorts() {
  await Promise.all(
    [3100, 19001, 11234, 14566].map(
      (port) =>
        new Promise<void>((accept, reject) => {
          const server = createServer();
          server.once("error", () =>
            reject(new Error(`E2E port ${port} is already in use`)),
          );
          server.listen(port, () =>
            server.close((error) => (error ? reject(error) : accept())),
          );
        }),
    ),
  );
}

async function waitForUrl(url: string, command: ProcessPromise) {
  for (let attempt = 0; attempt < 120; attempt++) {
    signal.throwIfAborted();
    if (command.stage === "fulfilled" || command.stage === "rejected")
      throw new Error(`Process exited while waiting for ${url}`);
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
      });
      await response.body?.cancel();
      if (response.ok) return;
    } catch {
      // Connection failures are expected while the service starts.
    }
    await sleep(1000, undefined, { signal });
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForLog(
  message: string,
  log: string,
  command: ProcessPromise,
) {
  for (let attempt = 0; attempt < 120; attempt++) {
    signal.throwIfAborted();
    if (command.stage === "fulfilled" || command.stage === "rejected") {
      throw new Error(`Transcription worker exited during startup. See ${log}`);
    }
    if ((await readFile(log, "utf8").catch(() => "")).includes(message)) return;
    await sleep(1000, undefined, { signal });
  }
  throw new Error(`Timed out waiting for the transcription worker. See ${log}`);
}

await mkdir(artifacts, { recursive: true });
const runtimeDir = await mkdtemp(resolve(tmpdir(), "giant-e2e-"));
process.env.E2E_RUNTIME_DIR = runtimeDir;
let servicesStarted = false;

try {
  await checkPorts();
  console.log("Building the E2E backend...");
  // Omit deployment JVM options (CloudWatch metrics, /var/log paths, default ports).
  await run`sbt -batch -J-Xmx2g -J-XX:ActiveProcessorCount=2 'set backend / Universal / javaOptions := Seq()' backend/stage > ${resolve(artifacts, "build.log")} 2>&1`;

  console.log("Starting disposable E2E services...");
  servicesStarted = true;
  await run`${compose} up -d --wait --wait-timeout 300`;
  const bucketLog = resolve(artifacts, "buckets.log");
  await writeFile(bucketLog, "");
  for (const bucket of [
    "ingest-data",
    "ingest-data-dead-letter",
    "data",
    "preview",
    "transcription-output-data",
    "remote-ingest-data",
  ]) {
    await run`${compose} exec -T garage /garage bucket create ${bucket} >> ${bucketLog} 2>&1`;
    await run`${compose} exec -T garage /garage bucket allow --read --write --owner --key garage-user ${bucket} >> ${bucketLog} 2>&1`;
  }

  const migrationLog = resolve(artifacts, "migrations.log");
  await run`npm ci --prefix infra/migrate-db > ${migrationLog} 2>&1`;
  await run`npm --prefix infra/migrate-db run start -- DEV 18432 >> ${migrationLog} 2>&1`;

  // Reuse application defaults without loading a developer's site.conf.
  const defaults = await readFile(
    resolve(repoDir, "backend/conf/application.conf"),
    "utf8",
  );
  const overrides = await readFile(
    resolve(e2eDir, "setup/application.conf"),
    "utf8",
  );
  const baseConfig =
    defaults.replace(/^include "site.conf"\r?\n/gm, "") + "\n" + overrides;
  async function startBackend(phase: "internal" | "external") {
    const configFile = resolve(runtimeDir, `${phase}.conf`);
    const phaseOverrides =
      phase === "external"
        ? await readFile(resolve(e2eDir, "setup/external.conf"), "utf8")
        : "";
    await writeFile(configFile, baseConfig + "\n" + phaseOverrides);
    const command =
      run`backend/target/universal/stage/bin/pfi -J-Xms256m -J-Xmx2g -J-XX:ActiveProcessorCount=2 -Dconfig.file=${configFile} -Dlogger.file=${resolve(e2eDir, "setup/logback.xml")} -Dhttp.address=127.0.0.1 -Dhttp.port=19001 -Dpidfile.path=${resolve(runtimeDir, "backend.pid")} > ${resolve(artifacts, `backend-${phase}.log`)} 2>&1`.nothrow();
    await waitForUrl("http://127.0.0.1:19001/healthcheck", command);
    // Returning the thenable process directly would wait for Giant to exit.
    return { command };
  }
  let backend = (await startBackend("internal")).command;
  const frontend =
    run`cd ${resolve(repoDir, "frontend")} && exec node node_modules/vite/bin/vite.js --config ${resolve(e2eDir, "vite.config.mts")} > ${resolve(artifacts, "frontend.log")} 2>&1`.nothrow();
  await waitForUrl("http://127.0.0.1:3100", frontend);

  console.log("Running genesis and internal extraction tests...");
  // Always establish the account and verify internal extraction before switching.
  const browserArgs = process.argv
    .slice(2)
    .filter((arg) => arg === "--headed" || arg === "--debug");
  // Both Playwright invocations connect to this browser. Only Giant restarts.
  browserServer = await chromium.launchServer({
    host: "127.0.0.1",
    headless: browserArgs.length === 0,
  });
  const browserEndpoint = browserServer.wsEndpoint();
  const authState = resolve(runtimeDir, "auth-state.json");
  await run`env E2E_PHASE=internal E2E_BROWSER_WS_ENDPOINT=${browserEndpoint} E2E_AUTH_STATE=${authState} npm --prefix ${e2eDir} run test:run -- --project=internal ${browserArgs}`;

  console.log("Preparing external transcription and OCR...");
  await access(resolve(transcriptionDir, "packages/worker/src/index.ts")).catch(
    () => {
      throw new Error(
        `Missing transcription-service checkout at ${transcriptionDir}. Clone guardian/transcription-service (branch local-giant-support) there, or set TRANSCRIPTION_SERVICE_DIR.`,
      );
    },
  );
  const whisperx = resolve(transcriptionDir, ".venv/bin/whisperx");
  await access(whisperx).catch(() => {
    throw new Error(
      `Missing WhisperX at ${whisperx}. Install transcription-service's Python dependencies before running E2E tests.`,
    );
  });
  await run`cd ${transcriptionDir} && npm run worker::build > ${resolve(artifacts, "transcription-build.log")} 2>&1`;
  await run`${compose} up -d --wait --wait-timeout 120 localstack`;
  await run`${compose} exec -T localstack python < ${resolve(e2eDir, "setup/init-transcription.py")} > ${resolve(artifacts, "transcription-setup.log")} 2>&1`;
  await backend.kill();
  await backend;
  backend = (await startBackend("external")).command;

  // Limit inference and OCR concurrency without changing the normal worker CLI.
  const workerBin = resolve(runtimeDir, "worker-bin");
  await mkdir(workerBin);
  await writeFile(
    resolve(workerBin, "whisperx"),
    '#!/bin/sh\nexec "$E2E_WHISPERX" --device cpu --threads 1 --batch_size 1 "$@"\n',
    { mode: 0o755 },
  );
  const ocrmypdf = resolve(transcriptionDir, ".venv/bin/ocrmypdf");
  await access(ocrmypdf);
  await writeFile(
    resolve(workerBin, "ocrmypdf"),
    '#!/bin/sh\nexec "$E2E_OCRMYPDF" --jobs 1 "$@"\n',
    { mode: 0o755 },
  );
  // OCR jobs use this relative path in DEV. Keep the worker's defaults except thread counts.
  await mkdir(resolve(runtimeDir, "rapidocr"));
  const rapidOcrConfig = await readFile(
    resolve(
      transcriptionDir,
      "packages/worker/rapidocr/rapidocr-config.local.yaml",
    ),
    "utf8",
  );
  await writeFile(
    resolve(runtimeDir, "rapidocr/rapidocr-config.local.yaml"),
    rapidOcrConfig.replace(
      /(intra_op_num_threads|inter_op_num_threads): -1/g,
      "$1: 1",
    ),
  );
  const workerLog = resolve(artifacts, "transcription-worker.log");
  const worker =
    run`cd ${runtimeDir} && exec env APP=transcription-service-gpu-worker STAGE=DEV AWS_REGION=eu-west-1 AWS_EC2_METADATA_DISABLED=true AWS_SHARED_CREDENTIALS_FILE=${resolve(e2eDir, "setup/aws-credentials")} AWS_ENDPOINT_URL_SSM=http://127.0.0.1:14566 LOCALSTACK_PORT=14566 SHAKIRA_MODE= HF_HUB_OFFLINE=1 HF_HUB_DISABLE_IMPLICIT_TOKEN=1 TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=true OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMEXPR_NUM_THREADS=1 TOKENIZERS_PARALLELISM=false E2E_WHISPERX=${whisperx} E2E_OCRMYPDF=${ocrmypdf} PATH=${workerBin + ":" + resolve(transcriptionDir, ".venv/bin") + ":" + process.env.PATH} node ${resolve(transcriptionDir, "packages/worker/dist/index.js")} > ${workerLog} 2>&1`.nothrow();
  await waitForLog("Worker reading from queue", workerLog, worker);

  console.log("Running external extraction tests...");
  // Account and internal tests already ran; dependencies must not run again.
  await run`env E2E_PHASE=external E2E_BROWSER_WS_ENDPOINT=${browserEndpoint} E2E_AUTH_STATE=${authState} npm --prefix ${e2eDir} run test:run -- --project=external --no-deps ${process.argv.slice(2)}`;
} catch (error) {
  process.exitCode ||= error instanceof ProcessOutput ? error.exitCode || 1 : 1;
  if (!signal.aborted) console.error(error);
} finally {
  await stopCommands();
  await browserServer?.close().catch((error) => {
    console.error(error);
    process.exitCode ||= 1;
  });
  if (servicesStarted) {
    // Wipe test database contents (Neo4j + Elasticsearch) before dropping the
    // volumes so the next run starts on a clean slate. Postgres is left alone
    // per #856 — its state isn't checked between runs. Best-effort: an empty
    // database is a no-op, and any failure here must not block teardown.
    await shell`${compose} exec -T neo4j cypher-shell -u neo4j -p password 'MATCH (n) DETACH DELETE n' > ${resolve(artifacts, "wipe-neo4j.log")} 2>&1`.nothrow();
    await shell`${compose} exec -T elasticsearch curl -sS -X POST 'http://localhost:9200/_delete_by_query?refresh=true&conflicts=proceed' -H 'Content-Type: application/json' -d '{"query":{"match_all":{}}}' > ${resolve(artifacts, "wipe-elasticsearch.log")} 2>&1`.nothrow();
    await shell`${compose} --profile external logs --no-color > ${resolve(artifacts, "services.log")} 2>&1`.nothrow();
    const cleanup =
      await shell`${compose} --profile external down --volumes --remove-orphans`.nothrow();
    if (cleanup.exitCode !== 0) process.exitCode ||= 1;
  }
  await rm(runtimeDir, { recursive: true, force: true });
  if (process.exitCode) console.error(`E2E run failed. Logs: ${artifacts}`);
}
