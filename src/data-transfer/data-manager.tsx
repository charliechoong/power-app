"use client";
import { useState } from "react";
import { useStorageMode } from "@/lib/storage-mode";
import { cloudRequest } from "@/lib/cloud-client";
import {
  downloadArchive,
  imageKey,
  readArchive,
  type ArchiveSelection,
} from "./image-archive";
import { getReflectionImage } from "@/features/reflections/client-repository";
import { getGratitudeImage } from "@/features/gratitude/client-repository";
import {
  MAX_BACKUP_BYTES,
  REFLECTIONS_PREFIX,
  READING_PREFIX,
  GRATITUDE_PREFIX,
  PLANS_PREFIX,
  SUBSCRIPTIONS_PREFIX,
  parseBackups,
  type Backup,
  type ImportCounts,
  type verifyImport,
} from "./format";

type Verification = ReturnType<typeof verifyImport>;
function localBackup(): Backup {
  const records: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith(REFLECTIONS_PREFIX) ||
        key.startsWith(READING_PREFIX) ||
        key.startsWith(GRATITUDE_PREFIX) ||
        key.startsWith(PLANS_PREFIX) ||
        key.startsWith(SUBSCRIPTIONS_PREFIX))
    )
      records[key] = localStorage.getItem(key) ?? "";
  }
  return { version: 1, exportedAt: new Date().toISOString(), records };
}
export function DataManager() {
  const mode = useStorageMode();
  const [backups, setBackups] = useState<unknown[]>([]);
  const [images, setImages] = useState<Map<string, Blob>>(new Map());
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<ImportCounts | null>(null);
  const [result, setResult] = useState<ImportCounts | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  function reset() {
    setError("");
    setMessage("");
    setPreview(null);
    setResult(null);
    setVerification(null);
    setBackups([]);
    setImages(new Map());
    setSummary("");
  }
  function select(values: ArchiveSelection[]) {
    const backups = values.map((item) => item.backup);
    const imageMap = new Map(values.flatMap((item) => [...item.images]));
    const data = parseBackups(backups);
    for (const entry of data.entries)
      if (entry.imagePath && !imageMap.has(imageKey("reflections", entry.id)))
        throw new Error(
          `The image for reflection ${entry.id} is missing from the selected backups.`,
        );
    for (const entry of data.gratitudes)
      if (entry.imagePath && !imageMap.has(imageKey("gratitude", entry.id)))
        throw new Error(
          `The image for gratitude entry ${entry.id} is missing from the selected backups.`,
        );
    if (
      new TextEncoder().encode(JSON.stringify({ backups, dryRun: false }))
        .byteLength > MAX_BACKUP_BYTES
    )
      throw new Error(
        "Use smaller backup files: the combined request must be under 3 MB.",
      );
    setBackups(backups);
    setImages(imageMap);
    setSummary(
      `${data.entries.length} reflections/quotes, ${imageMap.size} images, ${data.books.length} books, ${data.books.reduce((n, b) => n + b.notes.length, 0)} notes, ${data.gratitudes.length} gratitude entries, ${data.plans.length} plans, ${data.subscriptions.length} subscriptions.`,
    );
  }
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Your local data has not been changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="data-page">
      <p className="eyebrow">YOUR DATA, IN YOUR HANDS</p>
      <h1>Data & backups.</h1>
      <p>
        {mode === "cloud"
          ? "Your account uses online storage. Import your saved local data here."
          : "Your data is still on this device. Export a copy before moving online."}
      </p>
      <section className="data-panel">
        <h2>Keep a backup</h2>
        <p>
          Download reflections, books, progress, book notes, plans,
          subscriptions, gratitude entries, and their images together. This file
          contains private data. Backups with images download as ZIP files.
        </p>
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const backup =
                mode === "cloud"
                  ? await cloudRequest<Backup>("/api/data/export")
                  : localBackup();
              await downloadArchive(
                backup,
                mode,
                `commonplace-${new Date().toISOString().slice(0, 10)}`,
              );
              setMessage("Backup downloaded. Keep it somewhere safe.");
            })
          }
        >
          Download complete backup
        </button>
      </section>
      <section className="data-panel">
        <h2>Move your existing data online</h2>
        <p>
          Select your Reflections and Reading exports, or a complete backup.
          Existing cloud records are skipped, never overwritten. When a book
          already exists, its incoming notes are also skipped with that book.
        </p>
        <p>Your local data will remain in this browser after importing.</p>
        <label className="data-file">
          Choose JSON or ZIP backups
          <input
            type="file"
            accept=".json,.zip,application/json,application/zip"
            multiple
            disabled={busy}
            onChange={async (event) => {
              const files = Array.from(event.target.files ?? []);
              reset();
              if (!files.length) return;
              await run(async () => {
                select(await Promise.all(files.map(readArchive)));
              });
            }}
          />
        </label>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            reset();
            void run(async () => {
              const backup = localBackup();
              const imageMap = new Map<string, Blob>();
              for (const entry of parseBackups([backup]).entries)
                if (entry.imagePath)
                  imageMap.set(
                    imageKey("reflections", entry.id),
                    await getReflectionImage("local", entry),
                  );
              for (const entry of parseBackups([backup]).gratitudes)
                if (entry.imagePath)
                  imageMap.set(
                    imageKey("gratitude", entry.id),
                    await getGratitudeImage("local", entry),
                  );
              select([{ backup, images: imageMap }]);
            });
          }}
        >
          Use data saved in this browser
        </button>
        <p>{summary}</p>
        {mode === "local" && (
          <p className="data-callout">
            You can preview file contents here. Complete cloud setup and sign in
            to the hosted app to import them.
          </p>
        )}
        <div className="data-actions">
          <button
            className="button primary"
            disabled={busy || !backups.length || mode !== "cloud"}
            onClick={() =>
              void run(async () => {
                setResult(null);
                setVerification(null);
                setPreview(
                  await cloudRequest<ImportCounts>("/api/data/import", "POST", {
                    backups,
                    dryRun: true,
                  }),
                );
              })
            }
          >
            Preview cloud import
          </button>
        </div>
        {preview && (
          <div className="data-callout">
            <h3>Import preview</h3>
            <Counts counts={preview} />
            <button
              className="button primary"
              disabled={busy || !!result}
              onClick={() =>
                void run(async () => {
                  const imported = await cloudRequest<ImportCounts>(
                    "/api/data/import",
                    "POST",
                    { backups, dryRun: false },
                  );
                  if (images.size) {
                    const expected = parseBackups(backups);
                    const [currentReflections, currentGratitudes] =
                      await Promise.all([
                        cloudRequest<
                          import("@/features/reflections/model").Entry[]
                        >("/api/reflections"),
                        cloudRequest<
                          import("@/features/gratitude/model").GratitudeEntry[]
                        >("/api/gratitude"),
                      ]);
                    const reflectionsById = new Map(
                      currentReflections.map((entry) => [entry.id, entry]),
                    );
                    const gratitudesById = new Map(
                      currentGratitudes.map((entry) => [entry.id, entry]),
                    );
                    for (const entry of expected.entries) {
                      const blob = images.get(
                        imageKey("reflections", entry.id),
                      );
                      const target = reflectionsById.get(entry.id);
                      if (!blob || !target || target.imagePath) continue;
                      if (
                        target.kind !== entry.kind ||
                        target.content !== entry.content
                      )
                        continue;
                      const response = await fetch(
                        `/api/reflections/${encodeURIComponent(entry.id)}/image`,
                        {
                          method: "POST",
                          body: blob,
                          headers: {
                            "Content-Type": "image/webp",
                            "X-Image-Caption": encodeURIComponent(
                              entry.imageCaption ?? "",
                            ),
                          },
                        },
                      );
                      if (!response.ok)
                        throw new Error(
                          `Could not restore the image for reflection ${entry.id}. Retry the import.`,
                        );
                    }
                    for (const entry of expected.gratitudes) {
                      const blob = images.get(imageKey("gratitude", entry.id));
                      const target = gratitudesById.get(entry.id);
                      if (
                        !blob ||
                        !target ||
                        target.imagePath ||
                        target.content !== entry.content ||
                        target.title !== entry.title
                      )
                        continue;
                      const response = await fetch(
                        `/api/gratitude/${encodeURIComponent(entry.id)}/image`,
                        {
                          method: "POST",
                          body: blob,
                          headers: {
                            "Content-Type": "image/webp",
                            "X-Image-Caption": encodeURIComponent(
                              entry.imageCaption ?? "",
                            ),
                          },
                        },
                      );
                      if (!response.ok)
                        throw new Error(
                          `Could not restore the image for gratitude entry ${entry.id}. Retry the import.`,
                        );
                    }
                  }
                  setResult(imported);
                  setVerification(
                    await cloudRequest<Verification>(
                      "/api/data/verify",
                      "POST",
                      { backups },
                    ),
                  );
                  setMessage(
                    "Import completed. Your original browser data has not been removed.",
                  );
                })
              }
            >
              {busy ? "Working…" : "Import into my account"}
            </button>
          </div>
        )}
        {result && (
          <div className="data-callout">
            <h3>Import result</h3>
            <Counts counts={result} />
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  setVerification(
                    await cloudRequest<Verification>(
                      "/api/data/verify",
                      "POST",
                      { backups },
                    ),
                  ),
                )
              }
            >
              Verify imported data again
            </button>
          </div>
        )}
        {verification && (
          <div className="data-callout">
            <h3>Verification</h3>
            <p>
              {verification.matchedEntries} reflections/quotes,{" "}
              {verification.matchedBooks} books, and {verification.matchedNotes}{" "}
              notes, {verification.matchedGratitudes} gratitude entries, and{" "}
              {verification.matchedPlans} plans, and{" "}
              {verification.matchedSubscriptions} subscriptions match the
              backup.
            </p>
            {verification.differences.length ? (
              <>
                <p>
                  {verification.differences.length} records differ or are
                  missing. Existing cloud versions may have been kept. Retain
                  your backup and review before considering migration complete.
                </p>
                <ul>
                  {verification.differences.map((item) => (
                    <li key={item.module + item.id}>
                      {item.module}: {item.id}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                All selected records match. Keep your backup as an extra copy.
              </p>
            )}
          </div>
        )}
      </section>
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
function Counts({ counts }: { counts: ImportCounts }) {
  return (
    <>
      <p>
        Add: {counts.entriesAdded} reflections/quotes, {counts.booksAdded}{" "}
        books, {counts.notesAdded} notes, {counts.gratitudesAdded} gratitude
        entries, {counts.plansAdded} plans, {counts.subscriptionsAdded}{" "}
        subscriptions.
      </p>
      <p>
        Skip existing: {counts.entriesSkipped} reflections/quotes,{" "}
        {counts.booksSkipped} books, {counts.notesSkipped} notes,{" "}
        {counts.gratitudesSkipped} gratitude entries, {counts.plansSkipped}{" "}
        plans, {counts.subscriptionsSkipped} subscriptions.
      </p>
    </>
  );
}
