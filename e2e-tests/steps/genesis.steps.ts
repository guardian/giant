import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { test } from "../fixtures";

// Declared here rather than re-exported so IDE Cucumber plugins can index the steps.
const { Given, When, Then } = createBdd(test);

Given("a new install of Giant", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Create Genesis User" }),
  ).toBeVisible();
});

When(
  "I enter username {string}, display name {string}, and password {string} and continue",
  async ({ page }, username: string, displayName: string, password: string) => {
    await page.getByPlaceholder("Username", { exact: true }).fill(username);
    await page
      .getByPlaceholder("Display Name", { exact: true })
      .fill(displayName);
    await page.getByPlaceholder("Password", { exact: true }).fill(password);
    await page
      .getByPlaceholder("Confirm Password", { exact: true })
      .fill(password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  },
);

Then("I am offered two-factor authentication setup", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Setup Two Factor Authentication" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Authentication Code")).toBeEmpty();
});

When("I skip two-factor authentication", async ({ page }) => {
  const setupResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/setup" &&
      response.request().method() === "PUT",
  );
  await page
    .getByRole("button", { name: "Skip this step", exact: true })
    .click();
  expect((await setupResponse).ok()).toBeTruthy();
});

Then("I see the login page", async ({ page }) => {
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();
});

When(
  "I open user administration in a fresh browser session",
  async ({ freshPage }) => {
    await freshPage.goto("/settings/users");
    await expect(
      freshPage.getByRole("heading", { name: "Login", exact: true }),
    ).toBeVisible();
  },
);

When(
  "I log in as {string} with password {string}",
  async ({ freshPage }, username: string, password: string) => {
    await freshPage
      .getByPlaceholder("Username", { exact: true })
      .fill(username);
    await freshPage
      .getByPlaceholder("Password", { exact: true })
      .fill(password);
    await freshPage.getByRole("button", { name: "Login", exact: true }).click();
  },
);

Then(
  "I can access user administration without an authentication code",
  async ({ freshPage }) => {
    await expect(
      freshPage.getByRole("heading", { name: "Users", exact: true }),
    ).toBeVisible();
    await expect(freshPage.getByPlaceholder("Authentication Code")).toHaveCount(
      0,
    );
  },
);

Then(
  "user {string} named {string} is an administrator",
  async ({ freshPage }, username: string, displayName: string) => {
    const user = freshPage.getByRole("row").filter({
      has: freshPage.getByRole("cell", { name: username, exact: true }),
    });
    await expect(
      user.getByRole("cell", { name: displayName, exact: true }),
    ).toBeVisible();
    // Giant renders its admin checkbox as a styled div, not a native input.
    await expect(user.locator(".checkbox")).toHaveClass(/checkbox--checked/);
  },
);
