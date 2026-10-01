import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

test("capture, bold, edit, back up, and delete an experience", async ({
  page,
}) => {
  await page.goto("/gratitude");
  await expect(page.getByRole("heading", { name: "Gratitude." })).toBeVisible();
  const field = page.getByLabel("Your grateful experience");
  await page.getByLabel("Title (optional)").fill("A kind friend");
  await field.fill("I remember my friend helping me move.");
  await field.evaluate((element: HTMLTextAreaElement) => {
    element.focus();
    element.setSelectionRange(11, 20);
  });
  await page.getByRole("button", { name: "Bold selected text" }).click();
  await expect(field).toHaveValue("I remember **my friend** helping me move.");
  await expect(page.locator(".gratitude-preview strong")).toHaveText(
    "my friend",
  );
  await page.getByRole("button", { name: "Save experience" }).click();
  await expect(page.locator(".gratitude-card-title")).toHaveText(
    "A kind friend",
  );
  await expect(page.locator(".gratitude-card strong")).toHaveText("my friend");
  await page.reload();
  await expect(page.locator(".gratitude-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Title (optional)")).toHaveValue(
    "A kind friend",
  );
  await page.getByLabel("Title (optional)").fill("A lasting friendship");
  await field.fill("I am grateful for **our friendship**.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".gratitude-card strong")).toHaveText(
    "our friendship",
  );
  await expect(page.locator(".gratitude-card-title")).toHaveText(
    "A lasting friendship",
  );
  await page.getByPlaceholder("Search memories").fill("lasting friendship");
  await expect(page.locator(".gratitude-card")).toHaveCount(1);
  await page.getByPlaceholder("Search memories").fill("");
  await page.goto("/settings/data");
  await page
    .getByRole("button", { name: "Use data saved in this browser" })
    .click();
  await expect(
    page.getByText("1 gratitude entries.", { exact: false }),
  ).toBeVisible();
  await page.goto("/gratitude");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator(".gratitude-card")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("title remains optional", async ({ page }) => {
  await page.goto("/gratitude");
  await page
    .getByLabel("Your grateful experience")
    .fill("A quiet morning outside.");
  await page.getByRole("button", { name: "Save experience" }).click();
  await expect(page.locator(".gratitude-card")).toContainText(
    "A quiet morning outside.",
  );
  await expect(page.locator(".gratitude-card-title")).toHaveCount(0);
});

test("gratitude image previews before saving, persists, and joins the backup", async ({
  page,
}) => {
  await page.goto("/gratitude");
  await page
    .getByLabel("Your grateful experience")
    .fill("A place I remember warmly.");
  await expect(page.getByText("Add an image")).toBeVisible();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 10;
    canvas.getContext("2d")!.fillRect(0, 0, 10, 10);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Add an image").click();
  await (
    await chooserPromise
  ).setFiles({
    name: "moment.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await page.getByLabel("Caption").fill("A small joy");
  await page.getByRole("button", { name: "Save experience" }).click();
  await expect(page.locator(".gratitude-card img")).toBeVisible();
  await expect(page.locator(".gratitude-card figcaption")).toHaveText(
    "A small joy",
  );
  await page.reload();
  await expect(page.locator(".gratitude-card img")).toBeVisible();
  await page.goto("/settings/data");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download complete backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  expect(
    Object.keys(zip.files).some(
      (name) => name.startsWith("images/gratitude/") && name.endsWith(".webp"),
    ),
  ).toBe(true);
  await page.locator('input[type="file"]').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/zip",
    buffer: await readFile(await download.path()),
  });
  await expect(page.getByText(/1 images, 0 books/)).toBeVisible();
  await page.goto("/gratitude");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator(".image-attachment-thumb img")).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".gratitude-card img")).toHaveCount(0);
});
