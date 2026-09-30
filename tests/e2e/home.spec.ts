import { test, expect } from "@playwright/test";

test("homepage shows today's quote and links to every current section", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make space for what matters." }),
  ).toBeVisible();
  await expect(page.getByText("TODAY'S QUOTE")).toBeVisible();
  await expect(page.locator(".daily-quote blockquote")).not.toBeEmpty();
  await expect(
    page.getByRole("link", { name: /Explore reflections/ }),
  ).toHaveAttribute("href", "/reflections");
  await expect(
    page.getByRole("link", { name: /Open bookshelf/ }),
  ).toHaveAttribute("href", "/reading");
  await expect(
    page.getByRole("link", { name: /Read gratitude/ }),
  ).toHaveAttribute("href", "/gratitude");
  await page.getByRole("link", { name: /Explore reflections/ }).click();
  await expect(
    page.getByRole("heading", { name: "Reflections." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
