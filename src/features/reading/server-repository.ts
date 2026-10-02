import "server-only";
import {
  parseBook,
  validateBook,
  validateNote,
  validateReadingOrder,
  type BookInput,
} from "./model";
import type { OwnerContext } from "@/lib/server/http";
import { AccessError } from "@/lib/server/auth";

const fields =
  "id,title,author,status,currentPage:current_page,totalPages:total_pages,prerequisiteIds:prerequisite_ids,createdAt:created_at,updatedAt:updated_at";
function parse(value: unknown) {
  const book = parseBook(value);
  book.notes.sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
  return book;
}
export function readingServer({ db, owner }: OwnerContext) {
  async function notes(bookId?: string) {
    const result = new Map<string, unknown[]>();
    for (let offset = 0; ; offset += 500) {
      let query = db
        .from("reading_notes")
        .select("id,book_id,content,createdAt:created_at,updatedAt:updated_at")
        .eq("owner_id", owner);
      if (bookId) query = query.eq("book_id", bookId);
      const { data, error } = await query
        .order("book_id")
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      for (const note of data)
        result.set(note.book_id, [...(result.get(note.book_id) ?? []), note]);
      if (data.length < 500) return result;
    }
  }
  const repository = {
    async list() {
      const allNotes = await notes();
      const books = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("reading_books")
          .select(fields)
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        books.push(
          ...data.map((book) =>
            parse({ ...book, notes: allNotes.get(book.id) ?? [] }),
          ),
        );
        if (data.length < 500) return books;
      }
    },
    async get(id: string) {
      const { data, error } = await db
        .from("reading_books")
        .select(fields)
        .eq("owner_id", owner)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data
        ? parse({ ...data, notes: (await notes(id)).get(id) ?? [] })
        : null;
    },
    async save(input: BookInput, id?: string) {
      const book = validateBook(input);
      const bookId = id ?? crypto.randomUUID();
      if (book.prerequisiteIds.length) {
        const { data: order, error: orderError } = await db
          .from("reading_books")
          .select("id,prerequisiteIds:prerequisite_ids")
          .eq("owner_id", owner);
        if (orderError) throw orderError;
        validateReadingOrder(order, bookId, book.prerequisiteIds);
      }
      const now = new Date().toISOString();
      const record = {
        title: book.title,
        author: book.author,
        status: book.status,
        current_page: book.currentPage,
        total_pages: book.totalPages,
        prerequisite_ids: book.prerequisiteIds,
        updated_at: now,
      };
      const query = id
        ? db
            .from("reading_books")
            .update(record)
            .eq("owner_id", owner)
            .eq("id", id)
        : db.from("reading_books").insert({
            ...record,
            id: bookId,
            owner_id: owner,
            created_at: now,
          });
      const { data, error } = await query.select(fields).maybeSingle();
      if (error) throw error;
      if (!data) throw new AccessError(404, "Book not found.");
      return parse({
        ...data,
        notes: (await notes(data.id)).get(data.id) ?? [],
      });
    },
    async remove(id: string) {
      const { error } = await db
        .from("reading_books")
        .delete()
        .eq("owner_id", owner)
        .eq("id", id);
      if (error) throw error;
    },
    async saveNote(bookId: string, content: string, noteId?: string) {
      const clean = validateNote(content);
      const now = new Date().toISOString();
      const query = noteId
        ? db
            .from("reading_notes")
            .update({ content: clean, updated_at: now })
            .eq("owner_id", owner)
            .eq("book_id", bookId)
            .eq("id", noteId)
        : db.from("reading_notes").insert({
            owner_id: owner,
            book_id: bookId,
            id: crypto.randomUUID(),
            content: clean,
            created_at: now,
            updated_at: now,
          });
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new AccessError(404, "Note not found.");
      const book = await repository.get(bookId);
      if (!book) throw new AccessError(404, "Book not found.");
      return book;
    },
    async removeNote(bookId: string, noteId: string) {
      const { error } = await db
        .from("reading_notes")
        .delete()
        .eq("owner_id", owner)
        .eq("book_id", bookId)
        .eq("id", noteId);
      if (error) throw error;
      const book = await repository.get(bookId);
      if (!book) throw new AccessError(404, "Book not found.");
      return book;
    },
  };
  return repository;
}
