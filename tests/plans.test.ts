import test from "node:test";
import assert from "node:assert/strict";
import { createPlansRepository } from "../src/features/plans/local-repository";
import {
  planPercent,
  validatePlan,
  type PlanInput,
} from "../src/features/plans/model";
import {
  makeBackup,
  parseBackups,
  verifyImport,
} from "../src/data-transfer/format";

const input: PlanInput = {
  title: " Learn a course ",
  kind: "course",
  details: "",
  url: "",
  status: "planned",
  current: 0,
  target: 4,
  unit: "lessons",
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

test("plans support title-only capture, measured progress, completion and reopening", () => {
  const simple = validatePlan({
    ...input,
    title: "Research a question",
    kind: "question",
    target: null,
    unit: "",
  });
  assert.equal(simple.title, "Research a question");
  assert.equal(planPercent(simple), null);
  const started = validatePlan({ ...input, current: 1 });
  assert.equal(started.status, "doing");
  assert.equal(planPercent(started), 25);
  const done = validatePlan({ ...input, status: "done" });
  assert.equal(done.current, 4);
  assert.equal(planPercent(done), 100);
  assert.equal(
    validatePlan({ ...done, status: "doing", current: 3 }).status,
    "doing",
  );
  assert.throws(
    () => validatePlan({ ...input, url: "javascript:alert(1)" }),
    /http or https/,
  );
  assert.throws(() => validatePlan({ ...input, current: 5 }), /exceed/);
});

test("plans persist independently and round-trip through complete backups", async () => {
  const storage = memoryStorage();
  const repository = createPlansRepository(() => storage);
  const first = await repository.save(input);
  assert.equal((await repository.list())[0].title, "Learn a course");
  const updated = await repository.save({ ...first, current: 2 }, first);
  assert.equal(updated.status, "doing");
  assert.equal(updated.createdAt, first.createdAt);
  const data = { entries: [], books: [], gratitudes: [], plans: [updated] };
  const restored = parseBackups([makeBackup(data)]);
  assert.deepEqual(restored, data);
  assert.equal(verifyImport(data, restored).matchedPlans, 1);
  await repository.remove(first.id);
  assert.deepEqual(await repository.list(), []);
});
