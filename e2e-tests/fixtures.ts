import type { BrowserContext, Page } from "@playwright/test";
import { test as base } from "playwright-bdd";

export const test = base.extend<
  { freshPage: Page },
  { externalContext: BrowserContext | undefined }
>({
  externalContext: [
    async ({ browser }, use, workerInfo) => {
      if (workerInfo.project.name !== "external") {
        await use(undefined);
        return;
      }
      const context = await browser.newContext({
        baseURL: workerInfo.project.use.baseURL,
        storageState: process.env.E2E_AUTH_STATE,
      });
      try {
        await use(context);
      } finally {
        await context.close();
      }
    },
    { scope: "worker" },
  ],
  freshPage: async ({ browser, baseURL, externalContext }, use, testInfo) => {
    if (externalContext) {
      const page = await externalContext.newPage();
      try {
        await use(page);
      } finally {
        await page.close();
      }
      return;
    }
    // Genesis and internal tests still prove login works from a fresh session.
    const context = await browser.newContext({ baseURL });
    try {
      await use(await context.newPage());
      if (
        testInfo.project.name === "internal" &&
        testInfo.status === "passed" &&
        process.env.E2E_AUTH_STATE
      ) {
        await context.storageState({ path: process.env.E2E_AUTH_STATE });
      }
    } finally {
      await context.close();
    }
  },
});

export { expect } from "@playwright/test";
