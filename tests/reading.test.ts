import test from "node:test";
import assert from "node:assert/strict";
import {
  validateBook,
  progressPercent,
  filterBooks,
  parseBook,
  validateNote,
  type BookInput,
} from "../src/features/reading/model";
import {
  createReadingRepository,
  READING_STORAGE_PREFIX,
} from "../src/features/reading/local-repository";
import {
  createLocalRepository,
  STORAGE_PREFIX,
} from "../src/features/reflections/local-repository";

const draft: BookInput = {
  title: " The Creative Act ",
  author: " Rick Rubin ",
  status: "planned",
  currentPage: 0,
  totalPages: null,
};
function memoryStorage(): Storage {
  const records = new Map<string, string>();
  return {
    get length() {
      return records.size;
    },
    key: (index) => [...records.keys()][index] ?? null,
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => {
      records.set(key, value);
    },
    removeItem: (key) => {
      records.delete(key);
    },
    clear: () => records.clear(),
  };
}

test("books require only a title and validate whole-number page bounds", () => {
  assert.equal(
    validateBook({ ...draft, author: "" }).title,
    "The Creative Act",
  );
  for (const change of [
    { title: "  " },
    { currentPage: -1 },
    { currentPage: 1.5 },
    { currentPage: NaN },
    { totalPages: 0 },
    { totalPages: -3 },
    { totalPages: 2.5 },
    { currentPage: 101, totalPages: 100 },
  ]) {
    assert.throws(() => validateBook({ ...draft, ...change }));
  }
});

test("page progress moves a planned book into reading and finishes at the last page", () => {
  const reading = validateBook({ ...draft, currentPage: 25, totalPages: 100 });
  assert.equal(reading.status, "reading");
  assert.equal(progressPercent(reading), 25);
  const finished = validateBook({ ...reading, currentPage: 100 });
  assert.equal(finished.status, "finished");
  assert.equal(progressPercent(finished), 100);
  assert.equal(
    progressPercent(
      validateBook({ ...reading, currentPage: 999, totalPages: 1000 }),
    ),
    99,
  );
});

test("manual completion fills known pages and supports unknown totals", () => {
  const finished = validateBook({
    ...draft,
    status: "finished",
    totalPages: 200,
  });
  assert.equal(finished.currentPage, 200);
  const unknown = validateBook({
    ...draft,
    status: "finished",
    currentPage: 80,
  });
  assert.equal(unknown.status, "finished");
  assert.equal(progressPercent(unknown), 100);
  assert.equal(
    progressPercent(
      validateBook({ ...draft, status: "reading", currentPage: 20 }),
    ),
    null,
  );
  assert.equal(
    validateBook({ ...finished, status: "reading", currentPage: 50 }).status,
    "reading",
  );
});

test("reading and reflections persist independently, including edits and deletes", async () => {
  const storage = memoryStorage();
  const repo = createReadingRepository(() => storage);
  const otherTab = createReadingRepository(() => storage);
  const reflections = createLocalRepository(() => storage);
  const thought = await reflections.save({
    kind: "reflection",
    content: "Keep this thought",
    attribution: "",
  });
  const first = await repo.save(draft);
  await otherTab.save({ ...draft, title: "Another book" });
  const updated = await repo.save(
    { ...first, status: "reading", currentPage: 20, totalPages: 100 },
    first,
  );
  assert.equal(updated.id, first.id);
  assert.equal(updated.createdAt, first.createdAt);
  assert.equal(
    filterBooks(await otherTab.list(), "reading", "rubin").length,
    1,
  );
  await repo.remove(first.id);
  assert.equal((await otherTab.list()).length, 1);
  assert.equal((await reflections.list())[0].id, thought.id);
  assert.ok(storage.getItem(STORAGE_PREFIX + thought.id));
});

test("corrupt reading data is retained; unrelated corrupt data does not block reading", async () => {
  const storage = memoryStorage();
  const repo = createReadingRepository(() => storage);
  storage.setItem(STORAGE_PREFIX + "bad", "broken");
  assert.deepEqual(await repo.list(), []);
  storage.setItem(READING_STORAGE_PREFIX + "bad", "broken");
  await assert.rejects(repo.list(), /could not be read/);
  assert.equal(storage.getItem(READING_STORAGE_PREFIX + "bad"), "broken");
});

test("unavailable storage and failed writes reject instead of reporting success", async () => {
  const repo = createReadingRepository(() => {
    throw new Error("Storage unavailable");
  });
  await assert.rejects(repo.save(draft), /Storage unavailable/);
  await assert.rejects(repo.remove("any"), /Storage unavailable/);
});

test("legacy books load with empty notes without rewriting storage", async () => {
  const storage = memoryStorage();
  const old = {
    ...draft,
    id: "legacy",
    createdAt: "2026-09-26T00:00:00Z",
    updatedAt: "2026-09-26T00:00:00Z",
  };
  const raw = JSON.stringify(old);
  storage.setItem(READING_STORAGE_PREFIX + old.id, raw);
  const repo = createReadingRepository(() => storage);
  assert.deepEqual((await repo.get(old.id))?.notes, []);
  assert.equal(storage.getItem(READING_STORAGE_PREFIX + old.id), raw);
  assert.equal(await repo.get("missing"), null);
  assert.throws(() => parseBook({ ...old, notes: null }));
  assert.throws(() =>
    parseBook({ ...old, notes: [{ content: "bad metadata" }] }),
  );
});

test("notes validate content, stay scoped to their book, and survive stale progress edits", async () => {
  assert.throws(() => validateNote("  "));
  assert.throws(() => validateNote("a".repeat(10001)));
  const storage = memoryStorage();
  const repo = createReadingRepository(() => storage);
  const book = await repo.save(draft);
  const other = await repo.save({ ...draft, title: "Another book" });
  const withNote = await repo.saveNote(
    book.id,
    "  A useful idea\nTry it tomorrow.  ",
  );
  const note = withNote.notes[0];
  assert.equal(note.content, "A useful idea\nTry it tomorrow.");
  assert.deepEqual((await repo.get(other.id))?.notes, []);
  const progress = await repo.save(
    { ...book, status: "reading", currentPage: 15 },
    book,
  );
  assert.equal(progress.notes[0].id, note.id);
  const edited = await repo.saveNote(
    book.id,
    "Revised learning point",
    note.id,
  );
  assert.equal(edited.currentPage, 15);
  assert.equal(edited.notes[0].createdAt, note.createdAt);
  assert.equal(edited.notes[0].content, "Revised learning point");
  await assert.rejects(repo.saveNote(other.id, "Wrong book", note.id));
  await repo.removeNote(book.id, note.id);
  assert.deepEqual((await repo.get(book.id))?.notes, []);
  await assert.rejects(repo.saveNote(book.id, "Deleted note", note.id));
  await repo.saveNote(book.id, "Delete with book");
  await repo.remove(book.id);
  assert.equal(await repo.get(book.id), null);
  await assert.rejects(repo.saveNote(book.id, "No resurrection"));
  await assert.rejects(repo.save(book, book));
});

test("a failed note write leaves the previous saved notes intact", async () => {
  const storage = memoryStorage();
  const repo = createReadingRepository(() => storage);
  const book = await repo.save(draft);
  await repo.saveNote(book.id, "Saved note");
  storage.setItem = () => {
    throw new Error("Full");
  };
  await assert.rejects(repo.saveNote(book.id, "Failed note"), /Full/);
  assert.deepEqual(
    (await repo.get(book.id))?.notes.map((note) => note.content),
    ["Saved note"],
  );
});
