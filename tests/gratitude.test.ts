import test from "node:test";
import assert from "node:assert/strict";
import {
  gratitudeParts,
  validateGratitude,
  validateGratitudeInput,
} from "../src/features/gratitude/model";
import {
  makeBackup,
  parseBackups,
  verifyImport,
} from "../src/data-transfer/format";

test("bold markup renders only selected phrases and backup preserves them", () => {
  const content =
    "I was **really grateful** for my friend.\n**Another moment** stayed.";
  assert.deepEqual(gratitudeParts(content), [
    { text: "I was ", bold: false },
    { text: "really grateful", bold: true },
    { text: " for my friend.\n", bold: false },
    { text: "Another moment", bold: true },
    { text: " stayed.", bold: false },
  ]);
  const entry = {
    id: "g1",
    title: "A kind friend",
    content,
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
  };
  const data = { entries: [], books: [], gratitudes: [entry] };
  const restored = parseBackups([makeBackup(data)]);
  assert.deepEqual(restored, data);
  assert.deepEqual(verifyImport(data, restored).differences, []);
  assert.equal(verifyImport(data, restored).matchedGratitudes, 1);
});

test("empty gratitude entries are rejected", () => {
  assert.throws(() => validateGratitude("  "), /experience/);
  assert.deepEqual(validateGratitudeInput({ content: "  A moment  " }), {
    title: "",
    content: "A moment",
  });
  assert.throws(
    () =>
      validateGratitudeInput({ title: "x".repeat(201), content: "A moment" }),
    /200 characters/,
  );
});

test("old gratitude backups without a title remain importable", () => {
  const old = {
    id: "old",
    content: "An earlier experience",
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
  };
  const backup = {
    version: 1,
    exportedAt: old.createdAt,
    records: { "personal-hub:gratitude:v1:old": JSON.stringify(old) },
  };
  assert.equal(parseBackups([backup]).gratitudes[0].title, "");
});

test("gratitude images and captions verify across local and cloud paths", () => {
  const local = {
    id: "g-photo",
    title: "A moment",
    content: "Grateful for this place",
    imagePath: "local:g-photo",
    imageCaption: "At sunset",
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
  };
  const restored = parseBackups([
    makeBackup({ entries: [], books: [], gratitudes: [local] }),
  ]);
  assert.equal(restored.gratitudes[0].imageCaption, "At sunset");
  assert.equal(
    verifyImport(restored, {
      entries: [],
      books: [],
      gratitudes: [{ ...local, imagePath: "owner/new.webp" }],
    }).matchedGratitudes,
    1,
  );
  assert.equal(
    verifyImport(restored, {
      entries: [],
      books: [],
      gratitudes: [{ ...local, imagePath: undefined }],
    }).differences.length,
    1,
  );
});
