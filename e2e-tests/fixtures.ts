import type { Page } from "@playwright/test";
import { createBdd, test as base } from "playwright-bdd";

export const test = base.extend<{ freshPage: Page }>({
  // This independent session proves that genesis persisted a usable account.
  freshPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    try {
      await use(await context.newPage());
    } finally {
      await context.close();
    }
  },
});

export const { Given, When, Then } = createBdd(test);
export { expect } from "@playwright/test";
