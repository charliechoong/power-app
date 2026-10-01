"use client";

import JSZip from "jszip";
import { downloadJson } from "@/lib/download-json";
import { getReflectionImage } from "@/features/reflections/client-repository";
import { MAX_IMAGE_BYTES } from "@/features/reflections/image-storage";
import { parseBackups, type Backup } from "./format";

export type ArchiveSelection = { backup: Backup; images: Map<string, Blob> };
const imageName = (id: string) => `images/${encodeURIComponent(id)}.webp`;

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadArchive(
  backup: Backup,
  mode: "local" | "cloud",
  name: string,
) {
  const entries = parseBackups([backup]).entries.filter(
    (entry) => entry.imagePath,
  );
  if (!entries.length) {
    downloadJson(`${name}.json`, backup);
    return;
  }
  const zip = new JSZip();
  zip.file("backup.json", JSON.stringify(backup, null, 2));
  for (const entry of entries) {
    const blob = await getReflectionImage(mode, entry);
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error("An image exceeds the backup limit.");
    zip.file(imageName(entry.id), blob);
  }
  downloadBlob(
    `${name}.zip`,
    await zip.generateAsync({ type: "blob", compression: "DEFLATE" }),
  );
}

export async function readArchive(file: File): Promise<ArchiveSelection> {
  if (file.size > 100_000_000) throw new Error("Choose a backup under 100 MB.");
  if (file.name.toLowerCase().endsWith(".json")) {
    const backup = JSON.parse(await file.text()) as Backup;
    if (parseBackups([backup]).entries.some((entry) => entry.imagePath))
      throw new Error(
        "This JSON file refers to images but does not contain them. Choose the ZIP backup.",
      );
    return { backup, images: new Map() };
  }
  if (!file.name.toLowerCase().endsWith(".zip"))
    throw new Error("Choose a JSON or ZIP backup.");
  const zip = await JSZip.loadAsync(file);
  const manifest = zip.file("backup.json");
  if (!manifest) throw new Error("ZIP backup is missing backup.json.");
  const backup = JSON.parse(await manifest.async("string")) as Backup;
  const entries = parseBackups([backup]).entries.filter(
    (entry) => entry.imagePath,
  );
  const images = new Map<string, Blob>();
  for (const entry of entries) {
    const member = zip.file(imageName(entry.id));
    if (!member)
      throw new Error(
        `Backup is missing the image for reflection ${entry.id}.`,
      );
    const bytes = await member.async("uint8array");
    if (bytes.length > MAX_IMAGE_BYTES)
      throw new Error("A backup image exceeds 2 MB.");
    images.set(
      entry.id,
      new Blob([new Uint8Array(bytes)], { type: "image/webp" }),
    );
  }
  return { backup, images };
}
