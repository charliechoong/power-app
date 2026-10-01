"use client";
import { useStorageMode } from "@/lib/storage-mode";
import { cloudRequest } from "@/lib/cloud-client";
import { subscriptionsRepository } from "./local-repository";
import type { SubscriptionsRepository } from "./repository";
const path = (id: string) => `/api/subscriptions/${encodeURIComponent(id)}`;
const cloudRepository: SubscriptionsRepository = {
  list: () => cloudRequest("/api/subscriptions"),
  save: (input, existing) =>
    cloudRequest(
      existing ? path(existing.id) : "/api/subscriptions",
      existing ? "PUT" : "POST",
      input,
    ),
  remove: (id) => cloudRequest(path(id), "DELETE"),
};
export function useSubscriptionsRepository() {
  return useStorageMode() === "cloud"
    ? cloudRepository
    : subscriptionsRepository;
}
