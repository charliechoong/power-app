import { createSupabaseServerClient } from "@/lib/server/supabase";
import { assertSameOrigin } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  try {
    const db = await createSupabaseServerClient();
    const { error } = await db.auth.signOut();
    if (error) throw error;
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Could not sign out. Try again." },
      { status: 503 },
    );
  }
}
