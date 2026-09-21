import path from "node:path";
import { createBdd } from "playwright-bdd";
import { expect, test } from "../fixtures";

const { Given, When, Then } = createBdd(test);

Given("I open workspaces in a fresh browser session", async ({ freshPage }) => {
  await freshPage.goto("/workspaces");
  await expect(
    freshPage.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();
});

When(
  "I create a new workspace named {string}",
  async ({ freshPage }, name: string) => {
    const workspaceName = `${name} ${Date.now()}`;
    await freshPage
      .getByRole("button", { name: "New Workspace", exact: true })
      .click();
    await freshPage
      .getByPlaceholder("Name", { exact: true })
      .fill(workspaceName);
    await freshPage
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect(
      freshPage.getByRole("heading", { name: workspaceName }),
    ).toBeVisible();
  },
);

When(
  "I upload {string} to the workspace",
  async ({ freshPage }, filename: string) => {
    await freshPage
      .getByRole("button", { name: "Upload to workspace", exact: true })
      .click();
    const fileChooser = freshPage.waitForEvent("filechooser");
    await freshPage
      .getByRole("button", { name: "Add Files", exact: true })
      .click();
    await (
      await fileChooser
    ).setFiles(path.join(__dirname, "../fixtures", filename));
    await freshPage
      .getByRole("button", { name: "Upload", exact: true })
      .click();
    // Use the upload form's completion button, not the modal's corner dismiss.
    await freshPage
      .locator("form")
      .getByRole("button", { name: "Close", exact: true })
      .click();
  },
);

Then(
  "file {string} is successfully processed in the workspace",
  async ({ freshPage }, filename: string) => {
    const fileRow = freshPage.getByRole("row").filter({
      has: freshPage.getByText(filename, { exact: true }),
    });
    await expect(fileRow).toBeVisible();

    // Wait for either terminal icon, then require success so extraction errors fail.
    // These selectors correspond to Workspaces.renderIcon's processed/failed cases.
    await expect(
      fileRow.locator(
        "svg.file-browser__icon, i.exclamation.triangle.file-browser__icon",
      ),
    ).toBeVisible({ timeout: 180_000 });
    await expect(fileRow.locator("svg.file-browser__icon")).toBeVisible();
    await expect(fileRow.locator(".loader.file-browser__icon")).toHaveCount(0);
    await expect(fileRow.getByText("processed", { exact: true })).toBeVisible();
  },
);
