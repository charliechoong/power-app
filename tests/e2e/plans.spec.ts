import { test, expect } from "@playwright/test";

test("capture a plan, track lessons, edit, filter and complete", async ({
  page,
}) => {
  await page.goto("/plans");
  await expect(page).toHaveTitle("Plans · Commonplace");
  await page
    .getByPlaceholder("What do you want to do?")
    .fill("Take a Coursera course");
  await page.getByRole("button", { name: "Add plan", exact: true }).click();
  const card = page
    .getByRole("article")
    .filter({ hasText: "Take a Coursera course" });
  await expect(card).toContainText("To do");
  await card
    .getByRole("button", { name: "Edit Take a Coursera course" })
    .click();
  await page.getByLabel("Progress goal (optional)").fill("3");
  await page.getByLabel("Unit").fill("lessons");
  await page.getByRole("button", { name: "Save changes" }).click();
  await card.getByRole("button", { name: "+1 lessons" }).click();
  await expect(card.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "33",
  );
  await page.reload();
  await expect(card).toContainText("1 / 3 lessons");
  await card.getByRole("button", { name: "Complete" }).click();
  await expect(card).toContainText("3 / 3 lessons");
  await page
    .getByRole("group", { name: "Filter plans" })
    .getByRole("button", { name: /Done/ })
    .click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Reopen" }).click();
  await expect(card).toHaveCount(0);
  await page
    .getByRole("group", { name: "Filter plans" })
    .getByRole("button", { name: /All/ })
    .click();
  await expect(card).toContainText("2 / 3 lessons");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
