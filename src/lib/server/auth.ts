import "server-only";
import { cloudConfig, storageMode } from "./config";
import { createSupabaseServerClient } from "./supabase";

export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireOwner() {
  if (storageMode() !== "cloud")
    throw new AccessError(503, "Cloud storage is not configured.");
  let config;
  try {
    config = cloudConfig();
  } catch {
    throw new AccessError(503, "Cloud setup is incomplete.");
  }
  const db = await createSupabaseServerClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims)
    throw new AccessError(401, "Please sign in again.");
  if (data.claims.sub !== config.owner || data.claims.is_anonymous)
    throw new AccessError(403, "This account does not have access.");
  const allowed = await db.rpc("is_app_owner");
  if (allowed.error)
    throw new AccessError(503, "Database setup is incomplete or unavailable.");
  if (!allowed.data)
    throw new AccessError(403, "This account does not have access.");
  return { db, owner: data.claims.sub };
}
