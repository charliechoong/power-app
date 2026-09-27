import "server-only";

export function storageMode(): "local" | "cloud" {
  // A Vercel deployment must never silently fall back to unauthenticated local mode.
  if (process.env.VERCEL) return "cloud";
  return process.env.APP_STORAGE_MODE === "cloud" ? "cloud" : "local";
}

export function cloudConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const owner = process.env.APP_OWNER_ID;
  if (!url || !key || !owner || !/^[0-9a-f-]{36}$/i.test(owner))
    throw new Error("Cloud configuration is incomplete.");
  if (!url.startsWith("https://")) throw new Error("Supabase requires HTTPS.");
  return { url, key, owner };
}
