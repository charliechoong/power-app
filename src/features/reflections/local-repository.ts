import { parseEntry, validateInput, type Entry } from "./model";
import type { ReflectionsRepository } from "./repository";
import { deleteLocalImage } from "./image-storage";

export const STORAGE_PREFIX = "personal-hub:reflections:v1:";

// One key per entry prevents unrelated writes in different tabs overwriting each other.
// The last successful save wins when the same entry is edited in two tabs.
export function createLocalRepository(
  getStorage: () => Storage,
): ReflectionsRepository {
  return {
    async list() {
      const storage = getStorage();
      const entries: Entry[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(STORAGE_PREFIX)) continue;
        try {
          const raw = storage.getItem(key);
          if (raw === null) continue;
          const entry = parseEntry(JSON.parse(raw));
          if (key !== STORAGE_PREFIX + entry.id)
            throw new Error("Mismatched entry ID");
          entries.push(entry);
        } catch {
          throw new Error(
            "Some saved entries could not be read. Your data has not been changed. Download a backup before repairing browser storage.",
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
      const clean = validateInput(input);
      const now = new Date().toISOString();
      const entry: Entry = {
        ...clean,
        ...(existing?.imagePath ? { imagePath: existing.imagePath } : {}),
        id: existing?.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      getStorage().setItem(STORAGE_PREFIX + entry.id, JSON.stringify(entry));
      return entry;
    },
    async remove(id) {
      const existing = getStorage().getItem(STORAGE_PREFIX + id);
      getStorage().removeItem(STORAGE_PREFIX + id);
      if (existing && parseEntry(JSON.parse(existing)).imagePath)
        await deleteLocalImage(id);
    },
  };
}

export const localRepository = createLocalRepository(() => window.localStorage);
