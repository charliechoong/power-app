import { createSupabaseServerClient } from "@/lib/server/supabase";
import { cloudConfig, storageMode } from "@/lib/server/config";
import { assertSameOrigin, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  if (storageMode() !== "cloud")
    return Response.json(
      { error: "Cloud login is not configured." },
      { status: 503 },
    );
  try {
    const { email, password } = (await readJson(request, 10000)) as Record<
      string,
      unknown
    >;
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 320 ||
      password.length > 1024
    )
      return Response.json(
        { error: "Enter your email and password." },
        { status: 400 },
      );
    const db = await createSupabaseServerClient();
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      return Response.json(
        { error: "Sign in failed. Check your credentials or try again later." },
        { status: error.status === 429 ? 429 : 401 },
      );
    if (
      !data.user ||
      data.user.id !== cloudConfig().owner ||
      data.user.is_anonymous
    ) {
      await db.auth.signOut();
      return Response.json(
        { error: "This account does not have access." },
        { status: 403 },
      );
    }
    const allowed = await db.rpc("is_app_owner");
    if (allowed.error || !allowed.data) {
      await db.auth.signOut();
      return Response.json(
        { error: "Account access is not configured." },
        { status: 403 },
      );
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Sign in is unavailable. Check the cloud setup and try again." },
      { status: 503 },
    );
  }
}
