export const BOOK_STATUSES = ["planned", "reading", "finished"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];
export const STATUS_LABELS: Record<BookStatus, string> = {
  planned: "To read",
  reading: "Reading",
  finished: "Finished",
};
export type BookInput = {
  title: string;
  author: string;
  status: BookStatus;
  currentPage: number;
  totalPages: number | null;
  prerequisiteIds?: string[];
};
export type Book = Omit<BookInput, "prerequisiteIds"> & {
  prerequisiteIds: string[];
  id: string;
  createdAt: string;
  updatedAt: string;
  notes: BookNote[];
};

export const NOTE_LIMIT = 10000;
export type BookNote = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export function validateNote(content: string): string {
  if (typeof content !== "string" || !content.trim())
    throw new Error("Write a note or learning point first.");
  if (content.trim().length > NOTE_LIMIT)
    throw new Error("Keep notes under 10,000 characters.");
  return content.trim();
}

function parseNote(value: unknown): BookNote {
  if (!value || typeof value !== "object") throw new Error("Invalid note.");
  const note = value as BookNote;
  if (
    typeof note.id !== "string" ||
    !note.id ||
    typeof note.createdAt !== "string" ||
    !Number.isFinite(Date.parse(note.createdAt)) ||
    typeof note.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(note.updatedAt))
  )
    throw new Error("Invalid note.");
  return {
    id: note.id,
    content: validateNote(note.content),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function validateBook(
  input: BookInput,
): BookInput & { prerequisiteIds: string[] } {
  if (typeof input.title !== "string" || !input.title.trim())
    throw new Error("Give your book a title.");
  if (input.title.trim().length > 300)
    throw new Error("Keep the title under 300 characters.");
  if (typeof input.author !== "string" || input.author.trim().length > 300)
    throw new Error("Keep the author under 300 characters.");
  if (!BOOK_STATUSES.includes(input.status))
    throw new Error("Choose a valid reading status.");
  if (!Number.isSafeInteger(input.currentPage) || input.currentPage < 0)
    throw new Error("Current page must be a whole number, zero or higher.");
  if (
    input.totalPages !== null &&
    (!Number.isSafeInteger(input.totalPages) || input.totalPages < 1)
  )
    throw new Error(
      "Total pages must be a positive whole number, or left blank.",
    );
  if (input.totalPages !== null && input.currentPage > input.totalPages)
    throw new Error("Current page can’t exceed the total pages.");
  const prerequisiteIds = input.prerequisiteIds ?? [];
  if (
    !Array.isArray(prerequisiteIds) ||
    prerequisiteIds.length > 30 ||
    prerequisiteIds.some(
      (id) => typeof id !== "string" || !id || id.length > 200,
    ) ||
    new Set(prerequisiteIds).size !== prerequisiteIds.length
  )
    throw new Error("Choose up to 30 different books to read first.");
  let { status, currentPage } = input;
  if (status === "finished" && input.totalPages !== null)
    currentPage = input.totalPages;
  else if (input.totalPages !== null && currentPage === input.totalPages)
    status = "finished";
  else if (currentPage > 0 && status !== "finished") status = "reading";
  return {
    title: input.title.trim(),
    author: input.author.trim(),
    status,
    currentPage,
    totalPages: input.totalPages,
    prerequisiteIds,
  };
}

export function validateReadingOrder(
  books: Pick<Book, "id" | "prerequisiteIds">[],
  bookId: string,
  prerequisiteIds: string[],
) {
  const byId = new Map(books.map((book) => [book.id, book]));
  for (const prerequisiteId of prerequisiteIds) {
    if (prerequisiteId === bookId)
      throw new Error("A book cannot come before itself.");
    if (!byId.has(prerequisiteId))
      throw new Error(
        "A suggested earlier book no longer exists. Refresh and try again.",
      );
    const seen = new Set<string>();
    const visit = (id: string): boolean => {
      if (id === bookId) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return (byId.get(id)?.prerequisiteIds ?? []).some(visit);
    };
    if (visit(prerequisiteId))
      throw new Error(
        "That order would create a loop. Choose a different book.",
      );
  }
}

export function parseBook(value: unknown): Book {
  if (!value || typeof value !== "object") throw new Error("Invalid book.");
  const book = value as Book;
  if (
    typeof book.id !== "string" ||
    !book.id ||
    typeof book.createdAt !== "string" ||
    !Number.isFinite(Date.parse(book.createdAt)) ||
    typeof book.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(book.updatedAt))
  )
    throw new Error("Invalid book.");
  // Books saved before notes were introduced remain readable without rewriting them.
  const notes = book.notes === undefined ? [] : book.notes;
  if (!Array.isArray(notes)) throw new Error("Invalid book notes.");
  const parsedNotes = notes.map(parseNote);
  if (new Set(parsedNotes.map((note) => note.id)).size !== parsedNotes.length)
    throw new Error("Duplicate note IDs.");
  return {
    ...validateBook(book),
    id: book.id,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    notes: parsedNotes,
  };
}

export function progressPercent(book: BookInput): number | null {
  if (book.status === "finished") return 100;
  if (book.totalPages === null) return null;
  // Reserve 100% for actual completion, even for very long books.
  return Math.min(99, Math.floor((book.currentPage / book.totalPages) * 100));
}

export function filterBooks(
  books: Book[],
  status: BookStatus | "all",
  query: string,
) {
  const term = query.trim().toLocaleLowerCase();
  return books.filter(
    (book) =>
      (status === "all" || book.status === status) &&
      `${book.title} ${book.author}`.toLocaleLowerCase().includes(term),
  );
}
