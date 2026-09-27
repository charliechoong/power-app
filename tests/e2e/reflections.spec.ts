import { test, expect } from "@playwright/test";

test("capture, reload, quote, search, edit, delete, export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Reflections." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save thought", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Your reflection", { exact: true })
    .fill("A walk makes room for a thought.");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(page.locator("article")).toContainText(
    "A walk makes room for a thought.",
  );
  await page.reload();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Quote", exact: true }).click();
  await page
    .getByLabel("Quote text")
    .fill("Pay attention. Be astonished. Tell about it.");
  await page.getByLabel("Attribution").fill("Mary Oliver");
  await page.getByLabel("Quote text").press("Control+Enter");
  await expect(page.locator("article")).toHaveCount(2);
  await page.getByLabel("Search entries").fill("mary");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit entry", exact: true }).click();
  await page.getByLabel("Quote text").fill("Instructions for living a life.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("article")).toContainText(
    "Instructions for living a life.",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^reflections-.*\.json$/,
  );
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  await page
    .getByRole("group", { name: "Confirm deletion" })
    .getByRole("button", { name: "Delete entry" })
    .click();
  await expect(page.getByText("No thoughts found.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("article")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("failed save keeps draft and does not show a saved entry", async ({
  page,
}) => {
  await page.goto("/reflections");
  await expect(
    page.getByText("Leave a thought for your future self."),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page
    .getByLabel("Your reflection", { exact: true })
    .fill("Do not lose this thought");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn’t save" }),
  ).toContainText("Couldn’t save");
  await expect(page.getByLabel("Your reflection", { exact: true })).toHaveValue(
    "Do not lose this thought",
  );
  await expect(page.locator("article")).toHaveCount(0);
});

test("new entries sync between tabs", async ({ page, context }) => {
  await page.goto("/reflections");
  const other = await context.newPage();
  await other.goto("/reflections");
  await expect(
    other.getByText("Leave a thought for your future self."),
  ).toBeVisible();
  await page.getByLabel("Your reflection", { exact: true }).fill("Across tabs");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(other.locator("article")).toContainText("Across tabs");
});
