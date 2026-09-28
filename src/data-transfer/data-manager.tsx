"use client";
import { useState } from "react";
import { useStorageMode } from "@/lib/storage-mode";
import { cloudRequest } from "@/lib/cloud-client";
import { downloadJson } from "@/lib/download-json";
import {
  MAX_BACKUP_BYTES,
  REFLECTIONS_PREFIX,
  READING_PREFIX,
  GRATITUDE_PREFIX,
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
        key.startsWith(GRATITUDE_PREFIX))
    )
      records[key] = localStorage.getItem(key) ?? "";
  }
  return { version: 1, exportedAt: new Date().toISOString(), records };
}
export function DataManager() {
  const mode = useStorageMode();
  const [backups, setBackups] = useState<unknown[]>([]);
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
    setSummary("");
  }
  function select(values: unknown[]) {
    const data = parseBackups(values);
    if (
      new TextEncoder().encode(
        JSON.stringify({ backups: values, dryRun: false }),
      ).byteLength > MAX_BACKUP_BYTES
    )
      throw new Error(
        "Use smaller backup files: the combined request must be under 3 MB.",
      );
    setBackups(values);
    setSummary(
      `${data.entries.length} reflections/quotes, ${data.books.length} books, ${data.books.reduce((n, b) => n + b.notes.length, 0)} notes, ${data.gratitudes.length} gratitude entries.`,
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
          Download reflections, books, progress, book notes, and gratitude
          entries together. This file contains private data.
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
              downloadJson(
                `commonplace-${new Date().toISOString().slice(0, 10)}.json`,
                backup,
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
          Choose JSON backups
          <input
            type="file"
            accept=".json,application/json"
            multiple
            disabled={busy}
            onChange={async (event) => {
              const files = Array.from(event.target.files ?? []);
              reset();
              if (!files.length) return;
              await run(async () => {
                if (files.reduce((n, f) => n + f.size, 0) > MAX_BACKUP_BYTES)
                  throw new Error(
                    "Choose backup files totaling less than 3 MB.",
                  );
                select(
                  await Promise.all(
                    files.map(async (file) => JSON.parse(await file.text())),
                  ),
                );
              });
            }}
          />
        </label>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            reset();
            try {
              select([localBackup()]);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Could not read browser data.",
              );
            }
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
              notes, and {verification.matchedGratitudes} gratitude entries
              match the backup.
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
        entries.
      </p>
      <p>
        Skip existing: {counts.entriesSkipped} reflections/quotes,{" "}
        {counts.booksSkipped} books, {counts.notesSkipped} notes,{" "}
        {counts.gratitudesSkipped} gratitude entries.
      </p>
    </>
  );
}
