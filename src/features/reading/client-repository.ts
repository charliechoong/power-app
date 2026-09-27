"use client";
import { useStorageMode } from "@/lib/storage-mode";
import { cloudRequest } from "@/lib/cloud-client";
import { downloadJson } from "@/lib/download-json";
import {
  readingRepository,
  downloadReadingBackup,
  READING_STORAGE_PREFIX,
} from "./local-repository";
import type { ReadingRepository } from "./repository";
const path = (id: string) => `/api/reading/${encodeURIComponent(id)}`;
const cloudRepository: ReadingRepository = {
  list: () => cloudRequest("/api/reading"),
  get: (id) => cloudRequest(path(id)),
  save: (input, existing) =>
    cloudRequest(
      existing ? path(existing.id) : "/api/reading",
      existing ? "PUT" : "POST",
      input,
    ),
  remove: (id) => cloudRequest(path(id), "DELETE"),
  saveNote: (id, content, noteId) =>
    cloudRequest(
      path(id) + "/notes" + (noteId ? "/" + encodeURIComponent(noteId) : ""),
      noteId ? "PUT" : "POST",
      { content },
    ),
  removeNote: (id, noteId) =>
    cloudRequest(path(id) + "/notes/" + encodeURIComponent(noteId), "DELETE"),
};
export function useReadingRepository() {
  return useStorageMode() === "cloud" ? cloudRepository : readingRepository;
}
export async function exportReading(mode: "local" | "cloud") {
  if (mode === "local") return downloadReadingBackup();
  const books = await cloudRepository.list();
  downloadJson(`reading-${new Date().toISOString().slice(0, 10)}.json`, {
    version: 1,
    exportedAt: new Date().toISOString(),
    records: Object.fromEntries(
      books.map((book) => [
        READING_STORAGE_PREFIX + book.id,
        JSON.stringify(book),
      ]),
    ),
  });
}
