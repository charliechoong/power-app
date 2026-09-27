import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function addBook(page: Page, title: string) {
  await page.goto("/reading");
  await page.getByLabel("Book title").fill(title);
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  await expect(
    page.getByRole("article", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page).toHaveURL(/\/reading\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: title, exact: true, level: 1 }),
  ).toBeVisible();
}

test("book notes persist, edit, export, and delete without changing progress", async ({
  page,
}) => {
  await addBook(page, "The Creative Act");
  const noteForm = page.getByRole("form", { name: "Add a note", exact: true });
  await expect(
    noteForm.getByRole("button", { name: "Save note" }),
  ).toBeDisabled();
  await noteForm
    .getByLabel("Note or learning point")
    .fill("Notice more.\nMake space for ideas.");
  await noteForm.getByLabel("Note or learning point").press("Control+Enter");
  await expect(
    page.getByRole("article", { name: "Book note", exact: true }),
  ).toContainText("Make space for ideas.");
  await noteForm
    .getByLabel("Note or learning point")
    .fill("A second learning point.");
  await noteForm.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByRole("article", { name: "Book note", exact: true }),
  ).toHaveCount(2);
  await page.reload();
  const first = page
    .getByRole("article", { name: "Book note", exact: true })
    .filter({ hasText: "Notice more." });
  await first.getByRole("button", { name: "Edit note" }).click();
  await first
    .getByRole("textbox", { name: "Edit note", exact: true })
    .fill("Practice paying attention every day.");
  // The content filter changes while editing; select the edit form for submission.
  await page
    .getByRole("form", { name: "Edit note", exact: true })
    .getByRole("button", { name: "Save changes" })
    .click();
  await expect(
    page.getByText("Practice paying attention every day.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit book & progress" }).click();
  await page.getByLabel("Current page").fill("20");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("article", { name: "Book note", exact: true }),
  ).toHaveCount(2);
  await page.getByRole("link", { name: "Back to reading list" }).click();
  const book = page.getByRole("article", {
    name: "The Creative Act",
    exact: true,
  });
  await expect(book.getByRole("link", { name: "View notes" })).toContainText(
    "2",
  );
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const file = await (await downloading).path();
  const backup = JSON.parse(await readFile(file!, "utf8"));
  const exported = Object.values(backup.records).map((raw) =>
    JSON.parse(raw as string),
  );
  expect(exported[0].notes).toHaveLength(2);
  expect(
    exported[0].notes.some(
      (note: { content: string }) =>
        note.content === "Practice paying attention every day.",
    ),
  ).toBe(true);
  await book.getByRole("link", { name: "View notes" }).click();
  const second = page
    .getByRole("article", { name: "Book note", exact: true })
    .filter({ hasText: "A second learning point." });
  await second.getByRole("button", { name: "Delete note" }).click();
  await second.getByRole("button", { name: "Keep note" }).click();
  await expect(second).toBeVisible();
  await second.getByRole("button", { name: "Delete note" }).click();
  await second.getByRole("button", { name: "Delete permanently" }).click();
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Book note", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Book progress" }),
  ).toContainText("Page 20");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("notes stay with their book and sync across tabs", async ({
  page,
  context,
}) => {
  await addBook(page, "First book");
  const url = page.url();
  const other = await context.newPage();
  await other.goto(url);
  await expect(
    other.getByRole("heading", { name: "First book", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Note or learning point")
    .fill("Only belongs to the first book");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    other.getByRole("article", { name: "Book note", exact: true }),
  ).toContainText("Only belongs to the first book");
  await addBook(page, "Second book");
  await expect(
    page.getByRole("article", { name: "Book note", exact: true }),
  ).toHaveCount(0);
  await page.goto(url);
  await expect(
    page.getByRole("article", { name: "Book note", exact: true }),
  ).toHaveCount(1);
});

test("failed note saves preserve draft text and missing books have a helpful state", async ({
  page,
}) => {
  await addBook(page, "Keep my draft");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page
    .getByLabel("Note or learning point")
    .fill("Do not lose my learning point");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn’t save this note" }),
  ).toBeVisible();
  await expect(page.getByLabel("Note or learning point")).toHaveValue(
    "Do not lose my learning point",
  );
  await expect(
    page.getByRole("article", { name: "Book note", exact: true }),
  ).toHaveCount(0);
  await page.goto("/reading/missing-book");
  await expect(
    page.getByRole("heading", { name: "Book not found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to reading list" }),
  ).toBeVisible();
});
