import type { Book, BookInput } from "./model";

export interface ReadingRepository {
  list(): Promise<Book[]>;
  get(id: string): Promise<Book | null>;
  save(input: BookInput, existing?: Book): Promise<Book>;
  remove(id: string): Promise<void>;
  saveNote(bookId: string, content: string, noteId?: string): Promise<Book>;
  removeNote(bookId: string, noteId: string): Promise<Book>;
}
