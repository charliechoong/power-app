"use client";

export const MAX_IMAGE_BYTES = 2_000_000;

export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 25_000_000) throw new Error("Choose an image under 25 MB.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(
      "This image format could not be opened. Try a JPEG or PNG.",
    );
  });
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (blob?.type === "image/webp" && blob.size <= MAX_IMAGE_BYTES)
        return blob;
    }
    throw new Error(
      "This image is too large after resizing. Try a smaller one.",
    );
  } finally {
    bitmap.close();
  }
}
