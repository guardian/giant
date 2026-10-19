import { defineConfig } from "@playwright/test";
import { cucumberReporter, defineBddConfig } from "playwright-bdd";

const testDir = defineBddConfig({
  features: "features/*.feature",
  steps: ["fixtures.ts", "steps/*.steps.ts"],
});
// The lifecycle runner invokes Playwright once per phase. Keep both reports.
const reports = process.env.E2E_PHASE
  ? `reports/${process.env.E2E_PHASE}`
  : "reports";

export default defineConfig({
  testDir,
  outputDir: `${reports}/test-results`,
  workers: 1,
  // Genesis mutates the empty instance; retries require a new stack.
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  projects: [
    { name: "genesis", testMatch: "**/genesis.feature.spec.js" },
    {
      name: "internal",
      testIgnore: [
        "**/genesis.feature.spec.js",
        "**/external-extractors.feature.spec.js",
      ],
      dependencies: ["genesis"],
      timeout: 240_000,
    },
    {
      name: "external",
      testMatch: "**/external-extractors.feature.spec.js",
      dependencies: ["internal"],
      timeout: 240_000,
    },
  ],
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: `${reports}/playwright` }],
    cucumberReporter("html", { outputFile: `${reports}/cucumber/index.html` }),
  ],
  use: {
    connectOptions: process.env.E2E_BROWSER_WS_ENDPOINT
      ? { wsEndpoint: process.env.E2E_BROWSER_WS_ENDPOINT }
      : undefined,
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
