import "server-only";
import { parsePlan, validatePlan, type PlanInput } from "./model";
import type { OwnerContext } from "@/lib/server/http";
import { AccessError } from "@/lib/server/auth";
const fields =
  "id,title,kind,details,url,status,current,target,unit,createdAt:created_at,updatedAt:updated_at";
export function plansServer({ db, owner }: OwnerContext) {
  return {
    async get(id: string) {
      const { data, error } = await db
        .from("plans")
        .select(fields)
        .eq("owner_id", owner)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? parsePlan(data) : null;
    },
    async list() {
      const plans = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("plans")
          .select(fields)
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        plans.push(...data.map(parsePlan));
        if (data.length < 500) return plans;
      }
    },
    async save(input: PlanInput, id?: string) {
      const plan = validatePlan(input);
      const now = new Date().toISOString();
      const record = { ...plan, updated_at: now };
      const query = id
        ? db.from("plans").update(record).eq("owner_id", owner).eq("id", id)
        : db.from("plans").insert({
            ...record,
            owner_id: owner,
            id: crypto.randomUUID(),
            created_at: now,
          });
      const { data, error } = await query.select(fields).maybeSingle();
      if (error) throw error;
      if (!data) throw new AccessError(404, "Plan not found.");
      return parsePlan(data);
    },
    async remove(id: string) {
      const { error } = await db
        .from("plans")
        .delete()
        .eq("owner_id", owner)
        .eq("id", id);
      if (error) throw error;
    },
  };
}
