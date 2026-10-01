"use client";

import { cloudRequest } from "@/lib/cloud-client";
import { useStorageMode } from "@/lib/storage-mode";
import {
  localGratitudeRepository,
  GRATITUDE_STORAGE_PREFIX,
} from "./local-repository";
import type { GratitudeRepository } from "./repository";
import type { GratitudeEntry } from "./model";
import {
  getLocalGratitudeImage,
  putLocalGratitudeImage,
  deleteLocalGratitudeImage,
} from "./image-storage";

const cloudGratitudeRepository: GratitudeRepository = {
  list: () => cloudRequest("/api/gratitude"),
  save: (input, existing) =>
    cloudRequest(
      existing
        ? `/api/gratitude/${encodeURIComponent(existing.id)}`
        : "/api/gratitude",
      existing ? "PUT" : "POST",
      input,
    ),
  remove: (id) =>
    cloudRequest(`/api/gratitude/${encodeURIComponent(id)}`, "DELETE"),
};

export function useGratitudeRepository() {
  return useStorageMode() === "cloud"
    ? cloudGratitudeRepository
    : localGratitudeRepository;
}

export async function saveGratitudeImage(
  mode: "local" | "cloud",
  entry: GratitudeEntry,
  blob: Blob,
): Promise<GratitudeEntry> {
  if (mode === "cloud") {
    const response = await fetch(
      `/api/gratitude/${encodeURIComponent(entry.id)}/image`,
      {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "image/webp" },
      },
    );
    if (!response.ok) throw new Error("Could not upload the image.");
    return response.json();
  }
  await putLocalGratitudeImage(entry.id, blob);
  const updated = { ...entry, imagePath: `local:${entry.id}` };
  localStorage.setItem(
    GRATITUDE_STORAGE_PREFIX + entry.id,
    JSON.stringify(updated),
  );
  return updated;
}

export async function removeGratitudeImage(
  mode: "local" | "cloud",
  entry: GratitudeEntry,
): Promise<GratitudeEntry> {
  if (mode === "cloud")
    return cloudRequest(
      `/api/gratitude/${encodeURIComponent(entry.id)}/image`,
      "DELETE",
    );
  await deleteLocalGratitudeImage(entry.id);
  const updated: GratitudeEntry = {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
  localStorage.setItem(
    GRATITUDE_STORAGE_PREFIX + entry.id,
    JSON.stringify(updated),
  );
  return updated;
}

export function getGratitudeImage(
  mode: "local" | "cloud",
  entry: GratitudeEntry,
): Promise<Blob> {
  if (!entry.imagePath)
    return Promise.reject(new Error("This entry has no image."));
  if (mode === "local")
    return getLocalGratitudeImage(entry.id).then((blob) => {
      if (!blob) throw new Error("An image is missing from browser storage.");
      return blob;
    });
  return fetch(`/api/gratitude/${encodeURIComponent(entry.id)}/image`).then(
    (response) => {
      if (!response.ok) throw new Error("Could not download an image.");
      return response.blob();
    },
  );
}
