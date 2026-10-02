import {
  parseBook,
  validateBook,
  validateNote,
  validateReadingOrder,
  type Book,
} from "./model";
import type { ReadingRepository } from "./repository";

export const READING_STORAGE_PREFIX = "personal-hub:reading:v1:";

export function createReadingRepository(
  getStorage: () => Storage,
): ReadingRepository {
  function read(storage: Storage, id: string): Book | null {
    const raw = storage.getItem(READING_STORAGE_PREFIX + id);
    if (raw === null) return null;
    const book = parseBook(JSON.parse(raw));
    if (book.id !== id) throw new Error("Mismatched book ID.");
    return book;
  }
  function requireBook(storage: Storage, id: string): Book {
    const book = read(storage, id);
    if (!book) throw new Error("This book no longer exists.");
    return book;
  }
  function write(storage: Storage, book: Book): Book {
    storage.setItem(READING_STORAGE_PREFIX + book.id, JSON.stringify(book));
    return book;
  }
  const repository: ReadingRepository = {
    async get(id) {
      return read(getStorage(), id);
    },
    async list() {
      const storage = getStorage();
      const books: Book[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(READING_STORAGE_PREFIX)) continue;
        try {
          const raw = storage.getItem(key);
          if (raw === null) continue;
          const book = parseBook(JSON.parse(raw));
          if (key !== READING_STORAGE_PREFIX + book.id)
            throw new Error("Mismatched book ID");
          books.push(book);
        } catch {
          throw new Error(
            "Some books could not be read. Your data has not been changed. Export a backup before repairing browser storage.",
          );
        }
      }
      return books.sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
    },
    async save(input, existing) {
      const clean = validateBook(input);
      const storage = getStorage();
      // Read the latest record so editing progress cannot overwrite newly added notes.
      const current = existing ? requireBook(storage, existing.id) : undefined;
      const bookId = existing?.id ?? crypto.randomUUID();
      if (clean.prerequisiteIds.length)
        validateReadingOrder(
          await repository.list(),
          bookId,
          clean.prerequisiteIds,
        );
      const now = new Date().toISOString();
      const book: Book = {
        ...clean,
        id: bookId,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        notes: current?.notes ?? [],
      };
      return write(storage, book);
    },
    async remove(id) {
      const storage = getStorage();
      const dependents = (await repository.list()).filter((book) =>
        book.prerequisiteIds.includes(id),
      );
      for (const book of dependents)
        write(storage, {
          ...book,
          prerequisiteIds: book.prerequisiteIds.filter((value) => value !== id),
          updatedAt: new Date().toISOString(),
        });
      storage.removeItem(READING_STORAGE_PREFIX + id);
    },
    async saveNote(bookId, content, noteId) {
      const clean = validateNote(content);
      const storage = getStorage();
      const book = requireBook(storage, bookId);
      const existing = noteId
        ? book.notes.find((note) => note.id === noteId)
        : undefined;
      if (noteId && !existing) throw new Error("This note no longer exists.");
      const now = new Date().toISOString();
      const note = {
        id: existing?.id ?? crypto.randomUUID(),
        content: clean,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      return write(storage, {
        ...book,
        updatedAt: now,
        notes: existing
          ? book.notes.map((item) => (item.id === note.id ? note : item))
          : [note, ...book.notes],
      });
    },
    async removeNote(bookId, noteId) {
      const storage = getStorage();
      const book = requireBook(storage, bookId);
      return write(storage, {
        ...book,
        updatedAt: new Date().toISOString(),
        notes: book.notes.filter((note) => note.id !== noteId),
      });
    },
  };
  return repository;
}

export const readingRepository = createReadingRepository(
  () => window.localStorage,
);

export function downloadReadingBackup() {
  const records: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(READING_STORAGE_PREFIX))
      records[key] = localStorage.getItem(key) ?? "";
  }
  const blob = new Blob(
    [
      JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), records },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reading-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
