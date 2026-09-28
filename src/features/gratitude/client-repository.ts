"use client";

import { cloudRequest } from "@/lib/cloud-client";
import { useStorageMode } from "@/lib/storage-mode";
import { localGratitudeRepository } from "./local-repository";
import type { GratitudeRepository } from "./repository";

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
