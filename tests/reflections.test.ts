import test from "node:test";
import assert from "node:assert/strict";
import {
  validateInput,
  filterEntries,
} from "../src/features/reflections/model";
import {
  createLocalRepository,
  STORAGE_PREFIX,
} from "../src/features/reflections/local-repository";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
}

test("capture trims input, rejects blank text, and drops reflection attribution", () => {
  assert.throws(() =>
    validateInput({ kind: "quote", content: "  ", attribution: "" }),
  );
  assert.deepEqual(
    validateInput({
      kind: "reflection",
      content: " A thought ",
      attribution: "Unused",
    }),
    { kind: "reflection", content: "A thought", attribution: "" },
  );
  assert.throws(() =>
    validateInput({
      kind: "reflection",
      content: "a".repeat(10001),
      attribution: "",
    }),
  );
});

test("separate clients retain unrelated entries; edit preserves creation and identity; delete persists", async () => {
  const storage = memoryStorage();
  const first = createLocalRepository(() => storage);
  const second = createLocalRepository(() => storage);
  const a = await first.save({
    kind: "reflection",
    content: "Morning walk",
    attribution: "",
  });
  const b = await second.save({
    kind: "quote",
    content: "Pay attention",
    attribution: "Mary",
  });
  assert.equal((await first.list()).length, 2);
  const updated = await first.save({ ...a, content: "Evening walk" }, a);
  assert.equal(updated.id, a.id);
  assert.equal(updated.createdAt, a.createdAt);
  assert.equal(filterEntries(await second.list(), "quote", "mary")[0].id, b.id);
  await second.remove(a.id);
  assert.equal((await first.list()).length, 1);
});

test("unreadable entries fail visibly without being overwritten", async () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_PREFIX + "broken", "bad json");
  const repo = createLocalRepository(() => storage);
  await assert.rejects(repo.list(), /could not be read/);
  assert.equal(storage.getItem(STORAGE_PREFIX + "broken"), "bad json");
});

test("storage failure propagates rather than returning a successful entry", async () => {
  const repo = createLocalRepository(() => {
    throw new Error("Storage blocked");
  });
  await assert.rejects(
    repo.save({
      kind: "reflection",
      content: "Keep my draft",
      attribution: "",
    }),
    /Storage blocked/,
  );
});
