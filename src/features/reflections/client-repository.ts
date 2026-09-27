"use client";
import { useStorageMode } from "@/lib/storage-mode";
import { cloudRequest } from "@/lib/cloud-client";
import { downloadJson } from "@/lib/download-json";
import {
  localRepository,
  downloadBackup,
  STORAGE_PREFIX,
} from "./local-repository";
import type { ReflectionsRepository } from "./repository";
const cloudRepository: ReflectionsRepository = {
  list: () => cloudRequest("/api/reflections"),
  save: (input, existing) =>
    cloudRequest(
      existing
        ? `/api/reflections/${encodeURIComponent(existing.id)}`
        : "/api/reflections",
      existing ? "PUT" : "POST",
      input,
    ),
  remove: (id) =>
    cloudRequest(`/api/reflections/${encodeURIComponent(id)}`, "DELETE"),
};
export function useReflectionsRepository() {
  return useStorageMode() === "cloud" ? cloudRepository : localRepository;
}
export async function exportReflections(mode: "local" | "cloud") {
  if (mode === "local") return downloadBackup();
  const entries = await cloudRepository.list();
  downloadJson(`reflections-${new Date().toISOString().slice(0, 10)}.json`, {
    version: 1,
    exportedAt: new Date().toISOString(),
    records: Object.fromEntries(
      entries.map((entry) => [
        STORAGE_PREFIX + entry.id,
        JSON.stringify(entry),
      ]),
    ),
  });
}
