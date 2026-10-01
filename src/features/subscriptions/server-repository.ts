import "server-only";
import {
  parseSubscription,
  sortSubscriptions,
  validateSubscription,
  type SubscriptionInput,
} from "./model";
import type { OwnerContext } from "@/lib/server/http";
import { AccessError } from "@/lib/server/auth";
const fields =
  "id,name,amount,currency,billingCycle:billing_cycle,nextRenewal:next_renewal,status,url,notes,createdAt:created_at,updatedAt:updated_at";
export function subscriptionsServer({ db, owner }: OwnerContext) {
  return {
    async list() {
      const items = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("subscriptions")
          .select(fields)
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        items.push(...data.map(parseSubscription));
        if (data.length < 500) return sortSubscriptions(items);
      }
    },
    async get(id: string) {
      const { data, error } = await db
        .from("subscriptions")
        .select(fields)
        .eq("owner_id", owner)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? parseSubscription(data) : null;
    },
    async save(input: SubscriptionInput, id?: string) {
      const item = validateSubscription(input);
      const now = new Date().toISOString();
      const record = {
        name: item.name,
        amount: item.amount,
        currency: item.currency,
        billing_cycle: item.billingCycle,
        next_renewal: item.nextRenewal,
        status: item.status,
        url: item.url,
        notes: item.notes,
        updated_at: now,
      };
      const query = id
        ? db
            .from("subscriptions")
            .update(record)
            .eq("owner_id", owner)
            .eq("id", id)
        : db
            .from("subscriptions")
            .insert({
              ...record,
              owner_id: owner,
              id: crypto.randomUUID(),
              created_at: now,
            });
      const { data, error } = await query.select(fields).maybeSingle();
      if (error) throw error;
      if (!data) throw new AccessError(404, "Subscription not found.");
      return parseSubscription(data);
    },
    async remove(id: string) {
      const { error } = await db
        .from("subscriptions")
        .delete()
        .eq("owner_id", owner)
        .eq("id", id);
      if (error) throw error;
    },
  };
}
