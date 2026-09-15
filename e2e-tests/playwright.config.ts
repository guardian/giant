import { defineConfig } from "@playwright/test";
import { cucumberReporter, defineBddConfig } from "playwright-bdd";

const testDir = defineBddConfig({
  features: "features/*.feature",
  steps: ["fixtures.ts", "steps/*.steps.ts"],
});

export default defineConfig({
  testDir,
  outputDir: "reports/test-results",
  workers: 1,
  // Genesis mutates the empty instance; retries require a new stack.
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "reports/playwright" }],
    cucumberReporter("html", { outputFile: "reports/cucumber/index.html" }),
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
