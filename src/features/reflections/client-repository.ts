"use client";
import { useStorageMode } from "@/lib/storage-mode";
import { cloudRequest } from "@/lib/cloud-client";
import { localRepository, STORAGE_PREFIX } from "./local-repository";
import type { ReflectionsRepository } from "./repository";
import type { Entry } from "./model";
import {
  getLocalImage,
  putLocalImage,
  deleteLocalImage,
} from "./image-storage";
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
export async function saveReflectionImage(
  mode: "local" | "cloud",
  entry: Entry,
  blob: Blob,
): Promise<Entry> {
  if (mode === "cloud") {
    const response = await fetch(
      `/api/reflections/${encodeURIComponent(entry.id)}/image`,
      {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "image/webp" },
      },
    );
    if (!response.ok) throw new Error("Could not upload the image.");
    return response.json();
  }
  await putLocalImage(entry.id, blob);
  const updated = { ...entry, imagePath: `local:${entry.id}` };
  localStorage.setItem(STORAGE_PREFIX + entry.id, JSON.stringify(updated));
  return updated;
}
export async function removeReflectionImage(
  mode: "local" | "cloud",
  entry: Entry,
): Promise<Entry> {
  if (mode === "cloud")
    return cloudRequest(
      `/api/reflections/${encodeURIComponent(entry.id)}/image`,
      "DELETE",
    );
  await deleteLocalImage(entry.id);
  const updated: Entry = {
    id: entry.id,
    kind: entry.kind,
    content: entry.content,
    attribution: entry.attribution,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
  localStorage.setItem(STORAGE_PREFIX + entry.id, JSON.stringify(updated));
  return updated;
}
export function getReflectionImage(
  mode: "local" | "cloud",
  entry: Entry,
): Promise<Blob> {
  if (!entry.imagePath)
    return Promise.reject(new Error("This reflection has no image."));
  if (mode === "local")
    return getLocalImage(entry.id).then((blob) => {
      if (!blob) throw new Error("An image is missing from browser storage.");
      return blob;
    });
  return fetch(`/api/reflections/${encodeURIComponent(entry.id)}/image`).then(
    (response) => {
      if (!response.ok) throw new Error("Could not download an image.");
      return response.blob();
    },
  );
}
export async function exportReflections(mode: "local" | "cloud") {
  const entries =
    mode === "local"
      ? await localRepository.list()
      : await cloudRepository.list();
  const { downloadArchive } = await import("@/data-transfer/image-archive");
  await downloadArchive(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      records: Object.fromEntries(
        entries.map((entry) => [
          STORAGE_PREFIX + entry.id,
          JSON.stringify(entry),
        ]),
      ),
    },
    mode,
    `reflections-${new Date().toISOString().slice(0, 10)}`,
  );
}
