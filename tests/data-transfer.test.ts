import test from "node:test";
import assert from "node:assert/strict";
import {
  makeBackup,
  parseBackups,
  verifyImport,
} from "../src/data-transfer/format";
import type { ImportData } from "../src/data-transfer/format";

const date = "2026-09-25T01:00:00.000Z";
const source: ImportData = {
  entries: [
    {
      id: "reflection-1",
      kind: "quote",
      content: "Keep learning.",
      attribution: "Author",
      createdAt: date,
      updatedAt: date,
    },
  ],
  books: [
    {
      id: "book-1",
      title: "A book",
      author: "",
      status: "reading",
      currentPage: 10,
      totalPages: 100,
      createdAt: date,
      updatedAt: date,
      notes: [
        {
          id: "note-1",
          content: "A learning point",
          createdAt: date,
          updatedAt: date,
        },
      ],
    },
  ],
  gratitudes: [
    {
      id: "gratitude-1",
      title: "A memory",
      content: "I remember **that day**.",
      createdAt: date,
      updatedAt: date,
    },
  ],
};

test("combined and overlapping backups preserve all data and deduplicate identical IDs", () => {
  const backup = makeBackup(source);
  const parsed = parseBackups([backup, backup]);
  assert.deepEqual(parsed, source);
  assert.deepEqual(verifyImport(source, parsed), {
    matchedEntries: 1,
    matchedBooks: 1,
    matchedNotes: 1,
    matchedGratitudes: 1,
    differences: [],
  });
});

test("conflicting backups, damaged JSON and mismatched IDs fail before import", () => {
  const changed = structuredClone(source);
  changed.books[0].notes[0].content = "Changed";
  assert.throws(
    () => parseBackups([makeBackup(source), makeBackup(changed)]),
    /Conflicting/,
  );
  assert.throws(
    () =>
      parseBackups([
        { version: 1, records: { "personal-hub:reading:v1:broken": "{" } },
      ]),
    /invalid JSON/,
  );
  assert.throws(
    () =>
      parseBackups([
        {
          version: 1,
          records: {
            "personal-hub:reading:v1:wrong": JSON.stringify(source.books[0]),
          },
        },
      ]),
    /does not match/,
  );
  assert.throws(() => parseBackups([{ version: 2, records: {} }]), /version 1/);
  assert.throws(
    () => parseBackups([{ version: 1, records: { unexpected: "{}" } }]),
    /unrecognized/,
  );
});

test("legacy books without notes remain importable; changed or missing notes fail verification", () => {
  const backup = makeBackup(source);
  const old = { ...source.books[0], notes: undefined };
  backup.records["personal-hub:reading:v1:book-1"] = JSON.stringify(old);
  const parsed = parseBackups([backup]);
  assert.deepEqual(parsed.books[0].notes, []);
  assert.deepEqual(verifyImport(source, parsed).differences, [
    { module: "Reading", id: "book-1" },
  ]);
});
