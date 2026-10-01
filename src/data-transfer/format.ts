import { parseEntry, type Entry } from "@/features/reflections/model";
import { parseBook, type Book } from "@/features/reading/model";
import { parsePlan, type Plan } from "@/features/plans/model";
import {
  parseGratitude,
  type GratitudeEntry,
} from "@/features/gratitude/model";

export const REFLECTIONS_PREFIX = "personal-hub:reflections:v1:";
export const READING_PREFIX = "personal-hub:reading:v1:";
export const GRATITUDE_PREFIX = "personal-hub:gratitude:v1:";
export const PLANS_PREFIX = "personal-hub:plans:v1:";
export const MAX_BACKUP_BYTES = 3_000_000;
export type ImportData = {
  entries: Entry[];
  books: Book[];
  gratitudes: GratitudeEntry[];
  plans: Plan[];
};
export type ImportCounts = {
  entriesAdded: number;
  entriesSkipped: number;
  booksAdded: number;
  booksSkipped: number;
  notesAdded: number;
  notesSkipped: number;
  gratitudesAdded: number;
  gratitudesSkipped: number;
  plansAdded: number;
  plansSkipped: number;
};
export type Backup = {
  version: 1;
  exportedAt: string;
  records: Record<string, string>;
};
function idCheck(id: string) {
  if (!id || id.length > 200) throw new Error("Invalid record identifier.");
}
function normalizedEntry(value: unknown) {
  const entry = parseEntry(value);
  idCheck(entry.id);
  const { imagePath, ...record } = entry;
  return {
    ...record,
    ...(imagePath ? { imagePath: "attached" } : {}),
    createdAt: new Date(entry.createdAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString(),
  };
}
function normalizedBook(value: unknown) {
  const book = parseBook(value);
  idCheck(book.id);
  return {
    ...book,
    createdAt: new Date(book.createdAt).toISOString(),
    updatedAt: new Date(book.updatedAt).toISOString(),
    notes: book.notes
      .map((note) => {
        idCheck(note.id);
        return {
          ...note,
          createdAt: new Date(note.createdAt).toISOString(),
          updatedAt: new Date(note.updatedAt).toISOString(),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
function normalizedGratitude(value: unknown) {
  const entry = parseGratitude(value);
  idCheck(entry.id);
  const { imagePath, ...record } = entry;
  return {
    ...record,
    ...(imagePath ? { imagePath: "attached" } : {}),
    createdAt: new Date(entry.createdAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString(),
  };
}
function normalizedPlan(value: unknown) {
  const plan = parsePlan(value);
  idCheck(plan.id);
  return {
    ...plan,
    createdAt: new Date(plan.createdAt).toISOString(),
    updatedAt: new Date(plan.updatedAt).toISOString(),
  };
}

// Cross-domain import is application composition; neither domain imports the other.
export function parseBackups(backups: unknown): ImportData {
  if (!Array.isArray(backups) || backups.length < 1 || backups.length > 10)
    throw new Error("Choose one to ten backup files.");
  const entries = new Map<string, Entry>();
  const books = new Map<string, Book>();
  const gratitudes = new Map<string, GratitudeEntry>();
  const plans = new Map<string, Plan>();
  let count = 0;
  for (const input of backups) {
    if (!input || typeof input !== "object")
      throw new Error("Invalid backup file.");
    const backup = input as Backup;
    if (
      backup.version !== 1 ||
      !backup.records ||
      typeof backup.records !== "object" ||
      Array.isArray(backup.records)
    )
      throw new Error("Expected a Commonplace version 1 JSON backup.");
    for (const [key, raw] of Object.entries(backup.records)) {
      if (++count > 10000)
        throw new Error("Import up to 10,000 records at a time.");
      if (typeof raw !== "string") throw new Error("Invalid record in backup.");
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new Error(
          "A saved record contains invalid JSON. Nothing has been imported.",
        );
      }
      if (key.startsWith(REFLECTIONS_PREFIX)) {
        const entry = normalizedEntry(value);
        if (key !== REFLECTIONS_PREFIX + entry.id)
          throw new Error("Reflection ID does not match its storage key.");
        const old = entries.get(entry.id);
        if (old && JSON.stringify(old) !== JSON.stringify(entry))
          throw new Error(
            "Conflicting versions of the same reflection. Select only the backup you want to import.",
          );
        entries.set(entry.id, entry);
      } else if (key.startsWith(READING_PREFIX)) {
        const book = normalizedBook(value);
        if (key !== READING_PREFIX + book.id)
          throw new Error("Book ID does not match its storage key.");
        const old = books.get(book.id);
        if (old && JSON.stringify(old) !== JSON.stringify(book))
          throw new Error(
            "Conflicting versions of the same book. Select only the backup you want to import.",
          );
        books.set(book.id, book);
      } else if (key.startsWith(GRATITUDE_PREFIX)) {
        const entry = normalizedGratitude(value);
        if (key !== GRATITUDE_PREFIX + entry.id)
          throw new Error("Gratitude ID does not match its storage key.");
        const old = gratitudes.get(entry.id);
        if (old && JSON.stringify(old) !== JSON.stringify(entry))
          throw new Error(
            "Conflicting versions of the same gratitude entry. Select only the backup you want to import.",
          );
        gratitudes.set(entry.id, entry);
      } else if (key.startsWith(PLANS_PREFIX)) {
        const plan = normalizedPlan(value);
        if (key !== PLANS_PREFIX + plan.id)
          throw new Error("Plan ID does not match its storage key.");
        const old = plans.get(plan.id);
        if (old && JSON.stringify(old) !== JSON.stringify(plan))
          throw new Error(
            "Conflicting versions of the same plan. Select only the backup you want to import.",
          );
        plans.set(plan.id, plan);
      } else
        throw new Error(
          "This file includes unrecognized records. Nothing has been imported.",
        );
    }
  }
  return {
    entries: [...entries.values()],
    books: [...books.values()],
    gratitudes: [...gratitudes.values()],
    plans: [...plans.values()],
  };
}

export function makeBackup(data: ImportData): Backup {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    records: Object.fromEntries([
      ...data.entries.map((entry) => [
        REFLECTIONS_PREFIX + entry.id,
        JSON.stringify(entry),
      ]),
      ...data.books.map((book) => [
        READING_PREFIX + book.id,
        JSON.stringify(book),
      ]),
      ...data.gratitudes.map((entry) => [
        GRATITUDE_PREFIX + entry.id,
        JSON.stringify(entry),
      ]),
      ...data.plans.map((plan) => [
        PLANS_PREFIX + plan.id,
        JSON.stringify(plan),
      ]),
    ]),
  };
}

export function verifyImport(expected: ImportData, actual: ImportData) {
  const entries = new Map(
    actual.entries.map((entry) => [entry.id, normalizedEntry(entry)]),
  );
  const books = new Map(
    actual.books.map((book) => [book.id, normalizedBook(book)]),
  );
  const gratitudes = new Map(
    actual.gratitudes.map((entry) => [entry.id, normalizedGratitude(entry)]),
  );
  const plans = new Map(
    actual.plans.map((plan) => [plan.id, normalizedPlan(plan)]),
  );
  const differences: { module: string; id: string }[] = [];
  let matchedEntries = 0;
  let matchedBooks = 0;
  let matchedNotes = 0;
  let matchedGratitudes = 0;
  let matchedPlans = 0;
  for (const entry of expected.entries) {
    if (
      JSON.stringify(normalizedEntry(entry)) ===
      JSON.stringify(entries.get(entry.id))
    )
      matchedEntries++;
    else differences.push({ module: "Reflections", id: entry.id });
  }
  for (const book of expected.books) {
    if (
      JSON.stringify(normalizedBook(book)) ===
      JSON.stringify(books.get(book.id))
    ) {
      matchedBooks++;
      matchedNotes += book.notes.length;
    } else differences.push({ module: "Reading", id: book.id });
  }
  for (const entry of expected.gratitudes) {
    if (
      JSON.stringify(normalizedGratitude(entry)) ===
      JSON.stringify(gratitudes.get(entry.id))
    )
      matchedGratitudes++;
    else differences.push({ module: "Gratitude", id: entry.id });
  }
  for (const plan of expected.plans) {
    if (
      JSON.stringify(normalizedPlan(plan)) ===
      JSON.stringify(plans.get(plan.id))
    )
      matchedPlans++;
    else differences.push({ module: "Plans", id: plan.id });
  }
  return {
    matchedEntries,
    matchedBooks,
    matchedNotes,
    matchedGratitudes,
    matchedPlans,
    differences,
  };
}
