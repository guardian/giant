import { expect, test } from "@playwright/test";

test("creates the genesis administrator without two-factor authentication", async ({
  page,
  browser,
}) => {
  const username = "genesis-e2e";
  const displayName = "Genesis E2E";
  const password = "Genesis-e2e-password";

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Create Genesis User" }),
  ).toBeVisible();
  await page.getByPlaceholder("Username", { exact: true }).fill(username);
  await page
    .getByPlaceholder("Display Name", { exact: true })
    .fill(displayName);
  await page.getByPlaceholder("Password", { exact: true }).fill(password);
  await page
    .getByPlaceholder("Confirm Password", { exact: true })
    .fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Setup Two Factor Authentication" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Authentication Code")).toBeEmpty();
  const setupResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/setup" &&
      response.request().method() === "PUT",
  );
  await page
    .getByRole("button", { name: "Skip this step", exact: true })
    .click();
  expect((await setupResponse).ok()).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();

  // A fresh session proves the account persisted and needs no TOTP activation.
  const context = await browser.newContext();
  try {
    const loginPage = await context.newPage();
    await loginPage.goto("http://127.0.0.1:3100/settings/users");
    await expect(
      loginPage.getByRole("heading", { name: "Login", exact: true }),
    ).toBeVisible();
    await loginPage
      .getByPlaceholder("Username", { exact: true })
      .fill(username);
    await loginPage
      .getByPlaceholder("Password", { exact: true })
      .fill(password);
    await loginPage.getByRole("button", { name: "Login", exact: true }).click();
    await expect(
      loginPage.getByRole("heading", { name: "Users", exact: true }),
    ).toBeVisible();
    await expect(loginPage.getByPlaceholder("Authentication Code")).toHaveCount(
      0,
    );
    const user = loginPage.getByRole("row").filter({
      has: loginPage.getByRole("cell", { name: username, exact: true }),
    });
    await expect(
      user.getByRole("cell", { name: displayName, exact: true }),
    ).toBeVisible();
    // Giant renders its admin checkbox as a styled div, not a native input.
    await expect(user.locator(".checkbox")).toHaveClass(/checkbox--checked/);
  } finally {
    await context.close();
  }
});
