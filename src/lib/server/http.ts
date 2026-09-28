import "server-only";
import { AccessError, requireOwner } from "./auth";
import { cloudConfig, storageMode } from "./config";
import { createPublicReadClient } from "./supabase";

export class InputError extends Error {}
export type OwnerContext = Awaited<ReturnType<typeof requireOwner>>;

export async function publicReadRoute(
  action: (context: OwnerContext) => Promise<unknown>,
) {
  try {
    if (storageMode() !== "cloud")
      throw new AccessError(503, "Cloud storage is not configured.");
    const { owner } = cloudConfig();
    const data = await action({ db: createPublicReadClient(), owner });
    return Response.json(data ?? null, {
      headers: { "Cache-Control": "public, no-store" },
    });
  } catch {
    return Response.json(
      { error: "Content is unavailable. Please try again later." },
      { status: 503, headers: { "Cache-Control": "public, no-store" } },
    );
  }
}

export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  if (!origin || origin !== expected)
    throw new AccessError(403, "Request origin is not allowed.");
}

export async function readJson(
  request: Request,
  limit = 200_000,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new InputError("Use a JSON request.");
  if (Number(request.headers.get("content-length")) > limit)
    throw new InputError("The file or request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new InputError("The file or request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InputError("Invalid JSON.");
  }
}

export function validate<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new InputError(
      error instanceof Error ? error.message : "Invalid data.",
    );
  }
}

export async function ownerRoute(
  request: Request,
  action: (context: OwnerContext) => Promise<unknown>,
) {
  try {
    assertSameOrigin(request);
    const context = await requireOwner();
    const data = await action(context);
    return Response.json(data ?? null, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status =
      error instanceof AccessError
        ? error.status
        : error instanceof InputError
          ? 400
          : 503;
    const message =
      error instanceof AccessError || error instanceof InputError
        ? error.message
        : "The service is unavailable. Your unsaved changes have not been discarded.";
    return Response.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
