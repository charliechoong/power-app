import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cloudConfig, storageMode } from "@/lib/server/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (storageMode() !== "cloud") return response;
  response.headers.set("Cache-Control", "private, no-store");
  try {
    const { url, key } = cloudConfig();
    const client = createServerClient(url, key, {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure:
          !!process.env.VERCEL || process.env.APP_URL?.startsWith("https://"),
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          response.headers.set("Cache-Control", "private, no-store");
        },
      },
    });
    await client.auth.getUser();
  } catch {
    /* Protected layouts and API handlers deny access independently. */
  }
  return response;
}
export const config = {
  matcher: [
    "/",
    "/login",
    "/reflections/:path*",
    "/reading/:path*",
    "/settings/:path*",
  ],
};
