export type GratitudeEntry = {
  id: string;
  title: string;
  content: string;
  imagePath?: string;
  imageCaption?: string;
  createdAt: string;
  updatedAt: string;
};

export const GRATITUDE_CONTENT_LIMIT = 10000;
export const GRATITUDE_TITLE_LIMIT = 200;

export type GratitudeInput = Pick<
  GratitudeEntry,
  "title" | "content" | "imageCaption"
>;

export function validateGratitudeInput(value: unknown): GratitudeInput {
  if (!value || typeof value !== "object")
    throw new Error("Invalid gratitude entry.");
  const input = value as Partial<GratitudeInput>;
  if (input.title !== undefined && typeof input.title !== "string")
    throw new Error("Use text for the title.");
  const title = (input.title ?? "").trim();
  if (title.length > GRATITUDE_TITLE_LIMIT)
    throw new Error("Keep the title under 200 characters.");
  if (
    input.imageCaption !== undefined &&
    typeof input.imageCaption !== "string"
  )
    throw new Error("Use text for the image caption.");
  const imageCaption = input.imageCaption?.trim();
  if (imageCaption && imageCaption.length > 300)
    throw new Error("Keep the image caption under 300 characters.");
  return {
    title,
    content: validateGratitude(input.content),
    ...(imageCaption ? { imageCaption } : {}),
  };
}

export function validateGratitude(content: unknown): string {
  if (typeof content !== "string" || !content.trim())
    throw new Error("Write an experience you feel grateful for first.");
  const clean = content.trim();
  if (clean.length > GRATITUDE_CONTENT_LIMIT)
    throw new Error("Keep gratitude entries under 10,000 characters.");
  return clean;
}

export function parseGratitude(value: unknown): GratitudeEntry {
  if (!value || typeof value !== "object")
    throw new Error("Invalid gratitude entry.");
  const entry = value as GratitudeEntry;
  if (
    typeof entry.id !== "string" ||
    !entry.id ||
    typeof entry.createdAt !== "string" ||
    !Number.isFinite(Date.parse(entry.createdAt)) ||
    typeof entry.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(entry.updatedAt)) ||
    (entry.imagePath != null &&
      (typeof entry.imagePath !== "string" || entry.imagePath.length > 300))
  )
    throw new Error("Invalid gratitude entry.");
  return {
    id: entry.id,
    ...validateGratitudeInput(entry),
    ...(entry.imagePath ? { imagePath: entry.imagePath } : {}),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

// Only **bold** is supported. React escapes all text, so entries never become HTML.
export function gratitudeParts(
  content: string,
): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const matcher = /\*\*([^*\n]+)\*\*/g;
  let start = 0;
  for (const match of content.matchAll(matcher)) {
    const index = match.index ?? 0;
    if (index > start)
      parts.push({ text: content.slice(start, index), bold: false });
    parts.push({ text: match[1], bold: true });
    start = index + match[0].length;
  }
  if (start < content.length)
    parts.push({ text: content.slice(start), bold: false });
  return parts;
}
