export type EntryKind = "reflection" | "quote";
export type Entry = {
  id: string;
  kind: EntryKind;
  content: string;
  attribution: string;
  createdAt: string;
  updatedAt: string;
};
export type EntryInput = Pick<Entry, "kind" | "content" | "attribution">;
export const CONTENT_LIMIT = 10000;

export function validateInput(input: EntryInput): EntryInput {
  if (input.kind !== "reflection" && input.kind !== "quote")
    throw new Error("Choose a reflection or a quote.");
  const content = input.content.trim();
  if (!content) throw new Error("Write a little something first.");
  if (content.length > CONTENT_LIMIT)
    throw new Error("Please keep entries under 10,000 characters.");
  const attribution = input.kind === "quote" ? input.attribution.trim() : "";
  if (attribution.length > 300)
    throw new Error("Please keep the attribution under 300 characters.");
  return { kind: input.kind, content, attribution };
}

export function parseEntry(value: unknown): Entry {
  if (!value || typeof value !== "object") throw new Error("Invalid entry.");
  const entry = value as Entry;
  if (
    typeof entry.id !== "string" ||
    !entry.id ||
    typeof entry.content !== "string" ||
    typeof entry.attribution !== "string" ||
    typeof entry.createdAt !== "string" ||
    !Number.isFinite(Date.parse(entry.createdAt)) ||
    typeof entry.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(entry.updatedAt))
  )
    throw new Error("Invalid entry.");
  return {
    ...validateInput(entry),
    id: entry.id,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function filterEntries(
  entries: Entry[],
  kind: EntryKind | "all",
  query: string,
) {
  const term = query.trim().toLocaleLowerCase();
  return entries.filter(
    (entry) =>
      (kind === "all" || entry.kind === kind) &&
      `${entry.content} ${entry.attribution}`
        .toLocaleLowerCase()
        .includes(term),
  );
}
