import { parsePlan, validatePlan, type Plan } from "./model";
import type { PlansRepository } from "./repository";
export const PLANS_STORAGE_PREFIX = "personal-hub:plans:v1:";
export function createPlansRepository(
  getStorage: () => Storage,
): PlansRepository {
  return {
    async list() {
      const storage = getStorage();
      const plans: Plan[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith(PLANS_STORAGE_PREFIX)) continue;
        try {
          const raw = storage.getItem(key);
          if (!raw) continue;
          const plan = parsePlan(JSON.parse(raw));
          if (key !== PLANS_STORAGE_PREFIX + plan.id)
            throw new Error("Mismatched plan ID.");
          plans.push(plan);
        } catch {
          throw new Error(
            "Some plans could not be read. Export a backup before repairing browser storage.",
          );
        }
      }
      return plans.sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          a.id.localeCompare(b.id),
      );
    },
    async save(input, existing) {
      const storage = getStorage();
      const old = existing
        ? storage.getItem(PLANS_STORAGE_PREFIX + existing.id)
        : null;
      if (existing && !old) throw new Error("This plan no longer exists.");
      const now = new Date().toISOString();
      const plan: Plan = {
        ...validatePlan(input),
        id: existing?.id ?? crypto.randomUUID(),
        createdAt: old ? parsePlan(JSON.parse(old)).createdAt : now,
        updatedAt: now,
      };
      storage.setItem(PLANS_STORAGE_PREFIX + plan.id, JSON.stringify(plan));
      return plan;
    },
    async remove(id) {
      getStorage().removeItem(PLANS_STORAGE_PREFIX + id);
    },
  };
}
export const plansRepository = createPlansRepository(() => window.localStorage);
