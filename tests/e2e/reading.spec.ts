import { test, expect } from "@playwright/test";

test("map connects suggested earlier books and still allows starting the next book", async ({
  page,
}) => {
  await page.goto("/reading");
  for (const title of ["Book A", "Book B", "Book C"]) {
    await page.getByLabel("Book title").fill(title);
    await page.getByRole("button", { name: "Add book", exact: true }).click();
  }
  const map = page.getByRole("region", { name: "Reading map" });
  await map
    .getByRole("button", { name: "Set reading order for Book C" })
    .click();
  const editor = page.getByRole("form", { name: "Reading order for Book C" });
  await editor.getByRole("checkbox", { name: /Book A/ }).check();
  await editor.getByRole("checkbox", { name: /Book B/ }).check();
  await editor.getByRole("button", { name: "Save reading order" }).click();
  await expect(map.locator("path.reading-map-edge")).toHaveCount(2);
  await expect(map.getByText("0/2 earlier books finished")).toBeVisible();
  const next = page.getByRole("article", { name: "Book C" });
  await next.getByRole("button", { name: "Start reading" }).click();
  await expect(next).toContainText("Reading");
  await page.reload();
  await expect(map.locator("path.reading-map-edge")).toHaveCount(2);
  await expect(map.getByText("0/2 earlier books finished")).toBeVisible();
});

test("add a book, track pages, finish, reopen, filter, export and delete", async ({
  page,
}) => {
  await page.goto("/reading");
  await expect(page).toHaveTitle("Reading · Commonplace");
  const capture = page.getByRole("form", { name: "Add a book", exact: true });
  await capture.getByLabel("Book title").fill("The Creative Act");
  await capture.getByLabel("Author").fill("Rick Rubin");
  await capture.getByLabel("Total pages").fill("400");
  await capture.getByRole("button", { name: "Add book", exact: true }).click();
  const book = page.getByRole("article", {
    name: "The Creative Act",
    exact: true,
  });
  await expect(book).toContainText("To read");
  await book.getByRole("button", { name: "Start reading" }).click();
  await book.getByRole("button", { name: "Update progress" }).click();
  await book.getByLabel("Current page").fill("100");
  await book.getByRole("button", { name: "Save changes" }).click();
  await expect(book.getByRole("progressbar")).toHaveAttribute("value", "25");
  await page.reload();
  await expect(book).toContainText("100 of 400 pages");
  await book.getByRole("button", { name: "Update progress" }).click();
  await book.getByLabel("Current page").fill("401");
  await book.getByRole("button", { name: "Save changes" }).click();
  await expect(book.getByRole("progressbar")).toHaveAttribute("value", "25");
  await book.getByLabel("Current page").fill("400");
  await book.getByRole("button", { name: "Save changes" }).click();
  await expect(book).toContainText("Finished");
  await expect(book.getByRole("progressbar")).toHaveAttribute("value", "100");
  await page
    .getByRole("group", { name: "Filter books" })
    .getByRole("button", { name: "To read" })
    .click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Show all books" }).click();
  await page.getByLabel("Search books").fill("rubin");
  await expect(book).toBeVisible();
  await book.getByRole("button", { name: "Update progress" }).click();
  await book.getByLabel("Current page").fill("200");
  await book.getByRole("button", { name: "Save changes" }).click();
  await expect(book.getByRole("progressbar")).toHaveAttribute("value", "50");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  expect((await download).suggestedFilename()).toMatch(/^reading-.*\.json$/);
  await book.getByRole("button", { name: "Delete The Creative Act" }).click();
  await book.getByRole("button", { name: "Keep book" }).click();
  await expect(book).toBeVisible();
  await book.getByRole("button", { name: "Delete The Creative Act" }).click();
  await book.getByRole("button", { name: "Delete book", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("title-only capture and completion without a page total", async ({
  page,
}) => {
  await page.goto("/reading");
  await page.getByLabel("Book title").fill("An audiobook");
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  const book = page.getByRole("article", { name: "An audiobook" });
  await book.getByRole("button", { name: "Edit book" }).click();
  await book.getByLabel("Current page").fill("20");
  await book.getByRole("button", { name: "Save changes" }).click();
  await expect(book).toContainText("Page 20 · total pages not set");
  await expect(book.getByRole("progressbar")).toHaveCount(0);
  await book.getByRole("button", { name: "Update progress" }).click();
  await book.getByLabel("Reading status").selectOption("finished");
  await book.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(book).toContainText("Finished · total pages not set");
});

test("navigation highlights the active module and preserves reflection data", async ({
  page,
}) => {
  await page.goto("/reflections");
  await page
    .getByLabel("Your reflection", { exact: true })
    .fill("A thought to keep");
  await page.getByRole("button", { name: "Save thought", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("A thought to keep");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Reading", exact: true }).click();
  await expect(
    nav.getByRole("link", { name: "Reading", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Reflections", exact: true }),
  ).not.toHaveAttribute("aria-current");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByLabel("Book title").fill("A separate book");
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("A separate book");
  await nav.getByRole("link", { name: "Reflections", exact: true }).click();
  await expect(page).toHaveTitle("Reflections · Commonplace");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("A thought to keep");
});

test("failed writes keep book form values", async ({ page }) => {
  await page.goto("/reading");
  await expect(page.getByText("Your next chapter starts here.")).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByLabel("Book title").fill("Keep my book");
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn’t save this book" }),
  ).toBeVisible();
  await expect(page.getByLabel("Book title")).toHaveValue("Keep my book");
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("reading progress synchronizes across tabs", async ({ page, context }) => {
  await page.goto("/reading");
  const other = await context.newPage();
  await other.goto("/reading");
  await expect(other.getByText("Your next chapter starts here.")).toBeVisible();
  await page.getByLabel("Book title").fill("Shared across tabs");
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  const otherBook = other.getByRole("article", { name: "Shared across tabs" });
  await expect(otherBook).toBeVisible();
  await page.getByRole("button", { name: "Start reading" }).click();
  await expect(
    otherBook.getByRole("button", { name: "Update progress" }),
  ).toBeVisible();
});
