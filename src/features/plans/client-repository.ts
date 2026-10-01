"use client";
import { useStorageMode } from "@/lib/storage-mode";
import { cloudRequest } from "@/lib/cloud-client";
import { plansRepository } from "./local-repository";
import type { PlansRepository } from "./repository";
const path = (id: string) => `/api/plans/${encodeURIComponent(id)}`;
const cloudRepository: PlansRepository = {
  list: () => cloudRequest("/api/plans"),
  save: (input, existing) =>
    cloudRequest(
      existing ? path(existing.id) : "/api/plans",
      existing ? "PUT" : "POST",
      input,
    ),
  remove: (id) => cloudRequest(path(id), "DELETE"),
};
export function usePlansRepository() {
  return useStorageMode() === "cloud" ? cloudRepository : plansRepository;
}
