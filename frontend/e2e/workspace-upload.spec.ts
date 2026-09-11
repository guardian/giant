import { expect, test } from "@playwright/test";
import path from "node:path";

test("uploads a PDF to a new workspace and completes extraction", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const workspaceName = `Toast sandwich ${Date.now()}`;
  const filename = "toast_sandwich_en_wiki.pdf";

  await page.goto("/workspaces");
  await page.getByPlaceholder("Username", { exact: true }).fill("genesis-e2e");
  await page
    .getByPlaceholder("Password", { exact: true })
    .fill("Genesis-e2e-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await page
    .getByRole("button", { name: "New Workspace", exact: true })
    .click();
  await page.getByPlaceholder("Name", { exact: true }).fill(workspaceName);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: workspaceName }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Upload to workspace", exact: true })
    .click();
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add Files", exact: true }).click();
  await (await fileChooser).setFiles(path.join(__dirname, filename));
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  // Use the upload form's completion button, not the modal's corner dismiss.
  await page
    .locator("form")
    .getByRole("button", { name: "Close", exact: true })
    .click();

  const fileRow = page.getByRole("row").filter({
    has: page.getByText(filename, { exact: true }),
  });
  await expect(fileRow).toBeVisible();

  // A vanished spinner alone is insufficient: wait for either terminal icon,
  // then require the document icon so an extraction error cannot count as success.
  // The selectors correspond to Workspaces.renderIcon's processed/failed cases.
  await expect(
    fileRow.locator(
      "svg.file-browser__icon, i.exclamation.triangle.file-browser__icon",
    ),
  ).toBeVisible({ timeout: 180_000 });
  await expect(fileRow.locator("svg.file-browser__icon")).toBeVisible();
  await expect(fileRow.locator(".loader.file-browser__icon")).toHaveCount(0);
  await expect(fileRow.getByText("processed", { exact: true })).toBeVisible();
});
