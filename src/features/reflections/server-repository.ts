import "server-only";
import { parseEntry, validateInput, type EntryInput } from "./model";
import type { OwnerContext } from "@/lib/server/http";
import { AccessError } from "@/lib/server/auth";

const fields =
  "id,kind,content,attribution,imagePath:image_path,imageCaption:image_caption,createdAt:created_at,updatedAt:updated_at";
export function reflectionsServer({ db, owner }: OwnerContext) {
  return {
    async list() {
      const result = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await db
          .from("reflections")
          .select(fields)
          .eq("owner_id", owner)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        result.push(...data.map(parseEntry));
        if (data.length < 500) return result;
      }
    },
    async save(input: EntryInput, id?: string) {
      const clean = validateInput(input);
      const now = new Date().toISOString();
      const query = id
        ? db
            .from("reflections")
            .update({
              kind: clean.kind,
              content: clean.content,
              attribution: clean.attribution,
              image_caption: clean.imageCaption ?? "",
              updated_at: now,
            })
            .eq("owner_id", owner)
            .eq("id", id)
        : db.from("reflections").insert({
            kind: clean.kind,
            content: clean.content,
            attribution: clean.attribution,
            image_caption: clean.imageCaption ?? "",
            id: crypto.randomUUID(),
            owner_id: owner,
            created_at: now,
            updated_at: now,
          });
      const { data, error } = await query.select(fields).maybeSingle();
      if (error) throw error;
      if (!data) throw new AccessError(404, "Reflection not found.");
      return parseEntry(data);
    },
    async remove(id: string) {
      const previous = await db
        .from("reflections")
        .select("image_path")
        .eq("owner_id", owner)
        .eq("id", id)
        .maybeSingle();
      if (previous.error) throw previous.error;
      const { error } = await db
        .from("reflections")
        .delete()
        .eq("owner_id", owner)
        .eq("id", id);
      if (error) throw error;
      if (previous.data?.image_path)
        await db.storage
          .from("reflection-images")
          .remove([previous.data.image_path]);
    },
  };
}
