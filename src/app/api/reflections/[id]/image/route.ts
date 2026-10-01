import { ownerRoute, InputError } from "@/lib/server/http";
import { cloudConfig } from "@/lib/server/config";
import { createPublicReadClient } from "@/lib/server/supabase";
import { parseEntry } from "@/features/reflections/model";

type Context = { params: Promise<{ id: string }> };
const bucket = "reflection-images";
const fields =
  "id,kind,content,attribution,imagePath:image_path,imageCaption:image_caption,createdAt:created_at,updatedAt:updated_at";

export async function GET(_request: Request, { params }: Context) {
  try {
    const { owner } = cloudConfig();
    const db = createPublicReadClient();
    const { data, error } = await db
      .from("reflections")
      .select("image_path")
      .eq("owner_id", owner)
      .eq("id", (await params).id)
      .maybeSingle();
    if (error || !data?.image_path) return new Response(null, { status: 404 });
    const { data: image } = db.storage
      .from(bucket)
      .getPublicUrl(data.image_path);
    return Response.redirect(image.publicUrl, 302);
  } catch {
    return new Response(null, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Context) {
  return ownerRoute(request, async ({ db, owner }) => {
    if (request.headers.get("content-type") !== "image/webp")
      throw new InputError("Only a resized WebP image can be uploaded.");
    if (Number(request.headers.get("content-length")) > 2_000_000)
      throw new InputError("Image must be under 2 MB.");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (
      bytes.length > 2_000_000 ||
      bytes.length < 16 ||
      new TextDecoder().decode(bytes.slice(0, 4)) !== "RIFF" ||
      new TextDecoder().decode(bytes.slice(8, 12)) !== "WEBP"
    )
      throw new InputError("The image is invalid or too large.");
    const id = (await params).id;
    let caption: string | undefined;
    const encodedCaption = request.headers.get("x-image-caption");
    if (encodedCaption !== null) {
      try {
        caption = decodeURIComponent(encodedCaption);
      } catch {
        throw new InputError("Invalid image caption.");
      }
      if (caption.length > 300)
        throw new InputError("Image caption is too long.");
    }
    const current = await db
      .from("reflections")
      .select("kind,image_path")
      .eq("owner_id", owner)
      .eq("id", id)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data || current.data.kind !== "reflection")
      throw new InputError("Choose an existing reflection for this image.");
    const path = `${owner}/${crypto.randomUUID()}.webp`;
    const uploaded = await db.storage.from(bucket).upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploaded.error) throw uploaded.error;
    const updated = await db
      .from("reflections")
      .update({
        image_path: path,
        ...(caption !== undefined ? { image_caption: caption } : {}),
      })
      .eq("owner_id", owner)
      .eq("id", id)
      .select(fields)
      .single();
    if (updated.error) {
      await db.storage.from(bucket).remove([path]);
      throw updated.error;
    }
    if (current.data.image_path)
      await db.storage.from(bucket).remove([current.data.image_path]);
    return parseEntry(updated.data);
  });
}

export async function DELETE(request: Request, { params }: Context) {
  return ownerRoute(request, async ({ db, owner }) => {
    const id = (await params).id;
    const previous = await db
      .from("reflections")
      .select("image_path")
      .eq("owner_id", owner)
      .eq("id", id)
      .maybeSingle();
    if (previous.error) throw previous.error;
    if (!previous.data) throw new InputError("Reflection not found.");
    const updated = await db
      .from("reflections")
      .update({ image_path: null, image_caption: "" })
      .eq("owner_id", owner)
      .eq("id", id)
      .select(fields)
      .single();
    if (updated.error) throw updated.error;
    if (previous.data.image_path)
      await db.storage.from(bucket).remove([previous.data.image_path]);
    return parseEntry(updated.data);
  });
}
