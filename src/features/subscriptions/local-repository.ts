import {
  parseSubscription,
  sortSubscriptions,
  validateSubscription,
  type Subscription,
} from "./model";
import type { SubscriptionsRepository } from "./repository";
export const SUBSCRIPTIONS_STORAGE_PREFIX = "personal-hub:subscriptions:v1:";
export function createSubscriptionsRepository(
  getStorage: () => Storage,
): SubscriptionsRepository {
  return {
    async list() {
      const storage = getStorage();
      const items: Subscription[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith(SUBSCRIPTIONS_STORAGE_PREFIX)) continue;
        try {
          const raw = storage.getItem(key);
          if (!raw) continue;
          const item = parseSubscription(JSON.parse(raw));
          if (key !== SUBSCRIPTIONS_STORAGE_PREFIX + item.id)
            throw new Error("Mismatched subscription ID.");
          items.push(item);
        } catch {
          throw new Error(
            "Some subscriptions could not be read. Export a backup before repairing browser storage.",
          );
        }
      }
      return sortSubscriptions(items);
    },
    async save(input, existing) {
      const storage = getStorage();
      const old = existing
        ? storage.getItem(SUBSCRIPTIONS_STORAGE_PREFIX + existing.id)
        : null;
      if (existing && !old)
        throw new Error("This subscription no longer exists.");
      const now = new Date().toISOString();
      const item: Subscription = {
        ...validateSubscription(input),
        id: existing?.id ?? crypto.randomUUID(),
        createdAt: old ? parseSubscription(JSON.parse(old)).createdAt : now,
        updatedAt: now,
      };
      storage.setItem(
        SUBSCRIPTIONS_STORAGE_PREFIX + item.id,
        JSON.stringify(item),
      );
      return item;
    },
    async remove(id) {
      getStorage().removeItem(SUBSCRIPTIONS_STORAGE_PREFIX + id);
    },
  };
}
export const subscriptionsRepository = createSubscriptionsRepository(
  () => window.localStorage,
);
