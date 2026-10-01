"use client";

import JSZip from "jszip";
import { downloadJson } from "@/lib/download-json";
import { getReflectionImage } from "@/features/reflections/client-repository";
import { getGratitudeImage } from "@/features/gratitude/client-repository";
import { MAX_IMAGE_BYTES } from "@/lib/prepare-image";
import { parseBackups, type Backup } from "./format";

export type ArchiveSelection = { backup: Backup; images: Map<string, Blob> };
export const imageKey = (domain: "reflections" | "gratitude", id: string) =>
  `${domain}:${id}`;
const imageName = (domain: "reflections" | "gratitude", id: string) =>
  `images/${domain}/${encodeURIComponent(id)}.webp`;

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
  const data = parseBackups([backup]);
  const entries = data.entries.filter((entry) => entry.imagePath);
  const gratitudes = data.gratitudes.filter((entry) => entry.imagePath);
  if (!entries.length && !gratitudes.length) {
    downloadJson(`${name}.json`, backup);
    return;
  }
  const zip = new JSZip();
  zip.file("backup.json", JSON.stringify(backup, null, 2));
  for (const entry of entries) {
    const blob = await getReflectionImage(mode, entry);
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error("An image exceeds the backup limit.");
    zip.file(imageName("reflections", entry.id), blob);
  }
  for (const entry of gratitudes) {
    const blob = await getGratitudeImage(mode, entry);
    if (blob.size > MAX_IMAGE_BYTES)
      throw new Error("An image exceeds the backup limit.");
    zip.file(imageName("gratitude", entry.id), blob);
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
    const data = parseBackups([backup]);
    if ([...data.entries, ...data.gratitudes].some((entry) => entry.imagePath))
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
  const data = parseBackups([backup]);
  const entries = data.entries.filter((entry) => entry.imagePath);
  const gratitudes = data.gratitudes.filter((entry) => entry.imagePath);
  const images = new Map<string, Blob>();
  for (const entry of entries) {
    // Earlier reflection ZIPs used images/<id>.webp.
    const member =
      zip.file(imageName("reflections", entry.id)) ??
      zip.file(`images/${encodeURIComponent(entry.id)}.webp`);
    if (!member)
      throw new Error(
        `Backup is missing the image for reflection ${entry.id}.`,
      );
    const bytes = await member.async("uint8array");
    if (bytes.length > MAX_IMAGE_BYTES)
      throw new Error("A backup image exceeds 2 MB.");
    images.set(
      imageKey("reflections", entry.id),
      new Blob([new Uint8Array(bytes)], { type: "image/webp" }),
    );
  }
  for (const entry of gratitudes) {
    const member = zip.file(imageName("gratitude", entry.id));
    if (!member)
      throw new Error(
        `Backup is missing the image for gratitude entry ${entry.id}.`,
      );
    const bytes = await member.async("uint8array");
    if (bytes.length > MAX_IMAGE_BYTES)
      throw new Error("A backup image exceeds 2 MB.");
    images.set(
      imageKey("gratitude", entry.id),
      new Blob([new Uint8Array(bytes)], { type: "image/webp" }),
    );
  }
  return { backup, images };
}
