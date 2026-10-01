import { test, expect } from "@playwright/test";

test("add and track a subscription under Plans", async ({ page }) => {
  await page.goto("/plans");
  const section = page.getByRole("region", { name: "Subscriptions." });
  await expect(section).toBeVisible();
  await section.getByLabel("Service name").fill("GPT Pro");
  await section.getByLabel("Price (optional)").fill("200");
  await section.getByLabel("Currency").fill("USD");
  await section.getByLabel("Next renewal (optional)").fill("2026-11-01");
  await section
    .getByRole("button", { name: "Add subscription", exact: true })
    .click();
  const card = section.getByRole("article").filter({ hasText: "GPT Pro" });
  await expect(card).toContainText("200.00");
  await expect(card).toContainText("1 Nov 2026");
  await page.reload();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Pause" }).click();
  await expect(card).toHaveCount(0);
  await section
    .getByRole("group", { name: "Filter subscriptions" })
    .getByRole("button", { name: "Paused" })
    .click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Mark active" }).click();
  await section
    .getByRole("group", { name: "Filter subscriptions" })
    .getByRole("button", { name: "Active" })
    .click();
  await card.getByRole("button", { name: "Mark ending" }).click();
  await expect(card).toContainText("Ending");
  await expect(card).toContainText("Access ends: 1 Nov 2026");
  await section
    .getByRole("group", { name: "Filter subscriptions" })
    .getByRole("button", { name: "Ending" })
    .click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Mark active" }).click();
  await expect(card).toHaveCount(0);
  await section
    .getByRole("group", { name: "Filter subscriptions" })
    .getByRole("button", { name: "Active" })
    .click();
  await card.getByRole("button", { name: "Edit GPT Pro" }).click();
  await section.getByLabel("Billing cycle").selectOption("yearly");
  await section.getByRole("button", { name: "Save changes" }).click();
  await expect(card).toContainText("/ year");
  await card.getByRole("button", { name: "Mark canceled" }).click();
  await section
    .getByRole("group", { name: "Filter subscriptions" })
    .getByRole("button", { name: "Canceled" })
    .click();
  await expect(card).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
