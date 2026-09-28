import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cloudConfig } from "./config";

export async function createSupabaseServerClient() {
  const config = cloudConfig();
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure:
        !!process.env.VERCEL || process.env.APP_URL?.startsWith("https://"),
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server components cannot set cookies; proxy refreshes page sessions. */
        }
      },
    },
  });
}

export function createPublicReadClient() {
  const config = cloudConfig();
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
