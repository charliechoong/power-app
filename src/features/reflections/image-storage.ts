"use client";

export const MAX_IMAGE_BYTES = 2_000_000;
const STORE = "images";
const DATABASE = "commonplace-reflection-images";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function getLocalImage(id: string): Promise<Blob | undefined> {
  return transact("readonly", (store) => store.get(id));
}
export function putLocalImage(id: string, blob: Blob): Promise<IDBValidKey> {
  return transact("readwrite", (store) => store.put(blob, id));
}
export function deleteLocalImage(id: string): Promise<undefined> {
  return transact("readwrite", (store) => store.delete(id));
}

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
      if (blob && blob.type === "image/webp" && blob.size <= MAX_IMAGE_BYTES)
        return blob;
    }
    throw new Error(
      "This image is too large after resizing. Try a smaller one.",
    );
  } finally {
    bitmap.close();
  }
}
