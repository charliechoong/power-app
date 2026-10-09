import { test, expect } from "@playwright/test";

test("dragging books creates a suggested connection without an inner scroll area", async ({
  page,
}) => {
  await page.goto("/reading");
  for (const title of ["Book A", "Book C"]) {
    await page.getByLabel("Book title").fill(title);
    await page.getByRole("button", { name: "Add book", exact: true }).click();
  }
  const map = page.locator(".reading-map-frame");
  const source = map.locator("[data-reading-book-id]", { hasText: "Book C" });
  const target = map.locator("[data-reading-book-id]", { hasText: "Book A" });
  await source.scrollIntoViewIfNeeded();
  const from = await source.locator(".reading-map-drag-handle").boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Book positions unavailable");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(map.locator("path.reading-map-edge")).toHaveCount(1);
  await expect(map.getByText("0/1 earlier books finished")).toBeVisible();
  await expect(page.locator(".reading-map-drop-feedback cite")).toHaveText([
    "Book C",
    "Book A",
  ]);
  await expect(map.locator(".reading-map-node a cite")).toHaveCount(2);
  await expect(page.locator(".reading-book-info h3 cite")).toHaveCount(2);
  expect(await map.evaluate((node) => getComputedStyle(node).overflowY)).toBe(
    "visible",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(map.locator("path.reading-map-edge")).toHaveCount(1);
  await page
    .getByRole("article", { name: "Book A" })
    .getByRole("link", { name: "Book A" })
    .click();
  await expect(page.locator(".reading-detail-heading h1 cite")).toHaveText(
    "Book A",
  );
});

test("touch dragging from the handle connects books", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Touch gesture applies to the mobile layout",
  );
  await page.goto("/reading");
  for (const title of ["Book A", "Book C"]) {
    await page.getByLabel("Book title").fill(title);
    await page.getByRole("button", { name: "Add book", exact: true }).click();
  }
  const map = page.locator(".reading-map-frame");
  const source = map.locator("[data-reading-book-id]", { hasText: "Book C" });
  const target = map.locator("[data-reading-book-id]", { hasText: "Book A" });
  await source.scrollIntoViewIfNeeded();
  const from = await source.locator(".reading-map-drag-handle").boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Book positions unavailable");
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height / 2;
  const x2 = to.x + to.width / 2;
  const y2 = to.y + to.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x1, y: y1, id: 1 }],
  });
  for (let step = 1; step <= 8; step++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: x1 + ((x2 - x1) * step) / 8,
          y: y1 + ((y2 - y1) * step) / 8,
          id: 1,
        },
      ],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(map.locator("path.reading-map-edge")).toHaveCount(1);
});

test("map connects suggested earlier books and still allows starting the next book", async ({
  page,
}) => {
  await page.goto("/reading");
  for (const title of ["Book A", "Book B", "Book C"]) {
    await page.getByLabel("Book title").fill(title);
    await page.getByRole("button", { name: "Add book", exact: true }).click();
  }
  const map = page.locator(".reading-map-frame");
  await map
    .getByRole("button", { name: "Set reading order for Book C" })
    .click();
  const editor = page.getByRole("form", { name: "Reading order for Book C" });
  await expect(editor.locator("h3 cite")).toHaveText("Book C");
  await expect(editor.locator(".reading-map-options cite")).toHaveCount(2);
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
