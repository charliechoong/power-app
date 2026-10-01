import test from "node:test";
import assert from "node:assert/strict";
import { createSubscriptionsRepository } from "../src/features/subscriptions/local-repository";
import {
  formatPrice,
  sortSubscriptions,
  validateSubscription,
  type SubscriptionInput,
} from "../src/features/subscriptions/model";
import {
  makeBackup,
  parseBackups,
  verifyImport,
} from "../src/data-transfer/format";

const input: SubscriptionInput = {
  name: " GPT Pro ",
  amount: 0.29,
  currency: "usd",
  billingCycle: "monthly",
  nextRenewal: "2026-11-01",
  status: "active",
  url: "",
  notes: "",
};
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

test("subscriptions validate price, cycle, date, status and links", () => {
  const clean = validateSubscription(input);
  assert.equal(clean.name, "GPT Pro");
  assert.equal(clean.currency, "USD");
  assert.equal(clean.amount, 0.29);
  assert.match(formatPrice(clean), /0\.29.*month/);
  assert.throws(
    () => validateSubscription({ ...input, amount: 0.291 }),
    /two decimal/,
  );
  assert.throws(
    () => validateSubscription({ ...input, nextRenewal: "2026-02-30" }),
    /renewal date/,
  );
  assert.throws(
    () => validateSubscription({ ...input, url: "javascript:alert(1)" }),
    /http or https/,
  );
});

test("subscriptions persist and round-trip through complete backups", async () => {
  const storage = memoryStorage();
  const repository = createSubscriptionsRepository(() => storage);
  const first = await repository.save(input);
  assert.equal((await repository.list())[0].name, "GPT Pro");
  const paused = await repository.save({ ...first, status: "paused" }, first);
  assert.equal(paused.createdAt, first.createdAt);
  assert.equal(paused.status, "paused");
  assert.equal(
    sortSubscriptions([{ ...paused, status: "canceled" }, first])[0].status,
    "active",
  );
  const data = {
    entries: [],
    books: [],
    gratitudes: [],
    plans: [],
    subscriptions: [paused],
  };
  const restored = parseBackups([makeBackup(data)]);
  assert.deepEqual(restored, data);
  assert.equal(verifyImport(data, restored).matchedSubscriptions, 1);
  await repository.remove(first.id);
  assert.deepEqual(await repository.list(), []);
});

test("subscriptions sort by renewal date before status, with undated items last", () => {
  const item = {
    ...input,
    id: "base",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
  const ordered = sortSubscriptions([
    { ...item, id: "later-active", nextRenewal: "2026-12-01" },
    { ...item, id: "undated", nextRenewal: null },
    {
      ...item,
      id: "earlier-paused",
      status: "paused",
      nextRenewal: "2026-10-15",
    },
    { ...item, id: "earlier-active", nextRenewal: "2026-10-15" },
  ]);
  assert.deepEqual(
    ordered.map((subscription) => subscription.id),
    ["earlier-active", "earlier-paused", "later-active", "undated"],
  );
});
