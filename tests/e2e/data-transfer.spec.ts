import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("complete backup includes plans and notes without changing browser data", async ({
  page,
}) => {
  await page.goto("/settings/data");
  const date = "2026-09-25T01:00:00.000Z";
  const records = {
    "personal-hub:reflections:v1:r1": JSON.stringify({
      id: "r1",
      kind: "reflection",
      content: "Saved reflection",
      attribution: "",
      createdAt: date,
      updatedAt: date,
    }),
    "personal-hub:reading:v1:b1": JSON.stringify({
      id: "b1",
      title: "Saved book",
      author: "",
      status: "reading",
      currentPage: 3,
      totalPages: 10,
      createdAt: date,
      updatedAt: date,
      notes: [
        {
          id: "n1",
          content: "Learning point",
          createdAt: date,
          updatedAt: date,
        },
      ],
    }),
    "personal-hub:plans:v1:p1": JSON.stringify({
      id: "p1",
      title: "Take a course",
      kind: "course",
      details: "",
      url: "",
      status: "planned",
      current: 0,
      target: 5,
      unit: "lessons",
      createdAt: date,
      updatedAt: date,
    }),
    "personal-hub:subscriptions:v1:s1": JSON.stringify({
      id: "s1",
      name: "GPT Pro",
      amount: 200,
      currency: "USD",
      billingCycle: "monthly",
      nextRenewal: "2026-11-01",
      status: "active",
      url: "",
      notes: "",
      createdAt: date,
      updatedAt: date,
    }),
  };
  await page.evaluate((values) => {
    for (const [key, value] of Object.entries(values))
      localStorage.setItem(key, value);
  }, records);
  await page
    .getByRole("button", { name: "Use data saved in this browser" })
    .click();
  await expect(
    page.getByText(
      "1 reflections/quotes, 0 images, 1 books, 1 notes, 0 gratitude entries, 1 plans, 1 subscriptions.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview cloud import" }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download complete backup" }).click();
  const path = await (await download).path();
  expect(JSON.parse(await readFile(path!, "utf8")).records).toEqual(records);
  expect(
    await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))),
  ).toEqual(records);
});

test("cloud endpoints fail closed in local mode and reject cross-origin writes", async ({
  request,
}) => {
  for (const route of [
    "/api/reading",
    "/api/reflections",
    "/api/plans",
    "/api/subscriptions",
    "/api/data/export",
  ]) {
    const response = await request.get(route);
    expect(response.status()).toBe(503);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  const response = await request.post("/api/data/import", {
    headers: { origin: "https://untrusted.example" },
    data: { backups: [] },
  });
  expect(response.status()).toBe(403);
});
