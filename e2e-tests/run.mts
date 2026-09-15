import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { $, ProcessOutput, type ProcessPromise } from "zx";

const e2eDir = import.meta.dirname;
const repoDir = resolve(e2eDir, "..");
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
    [3100, 19001, 11234].map(
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

await mkdir(artifacts, { recursive: true });
const runtimeDir = await mkdtemp(resolve(tmpdir(), "giant-e2e-"));
process.env.E2E_RUNTIME_DIR = runtimeDir;
let servicesStarted = false;

try {
  await checkPorts();
  console.log("Building the E2E backend...");
  // Omit deployment JVM options (CloudWatch metrics, /var/log paths, default ports).
  await run`sbt -batch -J-Xmx2g 'set backend / Universal / javaOptions := Seq()' backend/stage > ${resolve(artifacts, "build.log")} 2>&1`;

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
  const configFile = resolve(runtimeDir, "application.conf");
  await writeFile(
    configFile,
    defaults.replace(/^include "site.conf"\r?\n/gm, "") + "\n" + overrides,
  );

  const backend =
    run`backend/target/universal/stage/bin/pfi -J-Xms256m -J-Xmx2g -Dconfig.file=${configFile} -Dlogger.file=${resolve(e2eDir, "setup/logback.xml")} -Dhttp.address=127.0.0.1 -Dhttp.port=19001 -Dpidfile.path=${resolve(runtimeDir, "backend.pid")} > ${resolve(artifacts, "backend.log")} 2>&1`.nothrow();
  await waitForUrl("http://127.0.0.1:19001/healthcheck", backend);

  const frontend =
    run`cd ${resolve(repoDir, "frontend")} && exec node node_modules/vite/bin/vite.js --config ${resolve(e2eDir, "vite.config.mts")} > ${resolve(artifacts, "frontend.log")} 2>&1`.nothrow();
  await waitForUrl("http://127.0.0.1:3100", frontend);

  console.log("Running Playwright against http://127.0.0.1:3100...");
  await run`npm --prefix ${e2eDir} run test:run -- ${process.argv.slice(2)}`;
} catch (error) {
  process.exitCode ||= error instanceof ProcessOutput ? error.exitCode || 1 : 1;
  if (!signal.aborted) console.error(error);
} finally {
  await stopCommands();
  if (servicesStarted) {
    await shell`${compose} logs --no-color > ${resolve(artifacts, "services.log")} 2>&1`.nothrow();
    const cleanup =
      await shell`${compose} down --volumes --remove-orphans`.nothrow();
    if (cleanup.exitCode !== 0) process.exitCode ||= 1;
  }
  await rm(runtimeDir, { recursive: true, force: true });
  if (process.exitCode) console.error(`E2E run failed. Logs: ${artifacts}`);
}
