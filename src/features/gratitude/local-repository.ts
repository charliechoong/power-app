import {
  parseGratitude,
  validateGratitudeInput,
  type GratitudeEntry,
} from "./model";
import type { GratitudeRepository } from "./repository";
import { deleteLocalGratitudeImage } from "./image-storage";

export const GRATITUDE_STORAGE_PREFIX = "personal-hub:gratitude:v1:";

export function createLocalGratitudeRepository(
  getStorage: () => Storage,
): GratitudeRepository {
  return {
    async list() {
      const storage = getStorage();
      const entries: GratitudeEntry[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(GRATITUDE_STORAGE_PREFIX)) continue;
        try {
          const raw = storage.getItem(key);
          if (raw === null) continue;
          const entry = parseGratitude(JSON.parse(raw));
          if (key !== GRATITUDE_STORAGE_PREFIX + entry.id)
            throw new Error("Mismatched gratitude ID.");
          entries.push(entry);
        } catch {
          throw new Error(
            "Some gratitude entries could not be read. Your data has not been changed. Download a backup before repairing browser storage.",
          );
        }
      }
      return entries.sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
    },
    async save(input, existing) {
      const now = new Date().toISOString();
      const entry: GratitudeEntry = {
        id: existing?.id ?? crypto.randomUUID(),
        ...validateGratitudeInput(input),
        ...(existing?.imagePath ? { imagePath: existing.imagePath } : {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      getStorage().setItem(
        GRATITUDE_STORAGE_PREFIX + entry.id,
        JSON.stringify(entry),
      );
      return entry;
    },
    async remove(id) {
      const existing = getStorage().getItem(GRATITUDE_STORAGE_PREFIX + id);
      getStorage().removeItem(GRATITUDE_STORAGE_PREFIX + id);
      if (existing && parseGratitude(JSON.parse(existing)).imagePath)
        await deleteLocalGratitudeImage(id);
    },
  };
}

export const localGratitudeRepository = createLocalGratitudeRepository(
  () => window.localStorage,
);
