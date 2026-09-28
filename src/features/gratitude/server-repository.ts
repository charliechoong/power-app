import "server-only";

import { AccessError } from "@/lib/server/auth";
import type { OwnerContext } from "@/lib/server/http";
import {
  parseGratitude,
  validateGratitudeInput,
  type GratitudeInput,
} from "./model";

const fields = "id,title,content,createdAt:created_at,updatedAt:updated_at";

export function gratitudeServer({ db, owner }: OwnerContext) {
  return {
    async list() {
      const result = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("gratitude_entries")
          .select(fields)
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        result.push(...data.map(parseGratitude));
        if (data.length < 500) return result;
      }
    },
    async save(input: GratitudeInput, id?: string) {
      const clean = validateGratitudeInput(input);
      const now = new Date().toISOString();
      const query = id
        ? db
            .from("gratitude_entries")
            .update({ ...clean, updated_at: now })
            .eq("owner_id", owner)
            .eq("id", id)
        : db.from("gratitude_entries").insert({
            id: crypto.randomUUID(),
            owner_id: owner,
            ...clean,
            created_at: now,
            updated_at: now,
          });
      const { data, error } = await query.select(fields).maybeSingle();
      if (error) throw error;
      if (!data) throw new AccessError(404, "Gratitude entry not found.");
      return parseGratitude(data);
    },
    async remove(id: string) {
      const { error } = await db
        .from("gratitude_entries")
        .delete()
        .eq("owner_id", owner)
        .eq("id", id);
      if (error) throw error;
    },
  };
}
