"use client";

import "./reflections.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import {
  CONTENT_LIMIT,
  filterEntries,
  type Entry,
  type EntryKind,
} from "../model";
import { STORAGE_PREFIX } from "../local-repository";
import {
  useReflectionsRepository,
  exportReflections,
} from "../client-repository";
import { useStorageMode } from "@/lib/storage-mode";
import { useCanEdit } from "@/lib/edit-access";

export function ReflectionsWorkspace() {
  const localRepository = useReflectionsRepository();
  const mode = useStorageMode();
  const canEdit = useCanEdit();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<EntryKind>("reflection");
  const [content, setContent] = useState("");
  const [attribution, setAttribution] = useState("");
  const [editing, setEditing] = useState<Entry>();
  const [filter, setFilter] = useState<EntryKind | "all">("all");
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLElement>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await localRepository.list());
      setStorageError("");
      setReady(true);
    } catch (reason) {
      setStorageError(
        reason instanceof Error
          ? reason.message
          : "Browser storage is unavailable.",
      );
      setReady(false);
    }
  }, [localRepository]);

  useEffect(() => {
    let active = true;
    localRepository
      .list()
      .then((items) => {
        if (active) {
          setEntries(items);
          setReady(true);
        }
      })
      .catch((reason) => {
        if (active)
          setStorageError(
            reason instanceof Error
              ? reason.message
              : "Browser storage is unavailable.",
          );
      });
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(STORAGE_PREFIX))
        void refresh();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => {
      if (mode === "cloud") void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, localRepository, mode]);

  const reset = () => {
    setContent("");
    setAttribution("");
    setEditing(undefined);
    setError("");
  };
  const focusCapture = () => {
    composer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textarea.current?.focus({ preventScroll: true });
  };

  async function save() {
    if (!canEdit || busyRef.current || !ready) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const entry = await localRepository.save(
        { kind, content, attribution },
        editing,
      );
      setEntries((previous) =>
        [...previous.filter((item) => item.id !== entry.id), entry].sort(
          (a, b) =>
            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
            a.id.localeCompare(b.id),
        ),
      );
      reset();
      setStatus(
        mode === "cloud"
          ? "Saved to your private account."
          : editing
            ? "Changes saved on this device."
            : "Saved on this device. A thought worth keeping.",
      );
      textarea.current?.focus();
    } catch {
      setError(
        "Couldn’t save this entry. Your text is still here. Check your connection or storage and try again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!canEdit || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await localRepository.remove(id);
      setEntries((previous) => previous.filter((entry) => entry.id !== id));
      if (editing?.id === id) reset();
      setPendingDelete(undefined);
      setStatus("Entry deleted.");
    } catch {
      setError("Couldn’t delete this entry. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function edit(entry: Entry) {
    if (
      (content.trim() || editing) &&
      !window.confirm("Replace the unsaved text in the capture box?")
    )
      return;
    setEditing(entry);
    setKind(entry.kind);
    setContent(entry.content);
    setAttribution(entry.attribution);
    setError("");
    setStatus("");
    focusCapture();
  }

  const visible = filterEntries(entries, filter, query);
  const reflections = entries.filter(
    (entry) => entry.kind === "reflection",
  ).length;
  const quotes = entries.length - reflections;

  return (
    <div className="reflections-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">NOTICE. CAPTURE. COME BACK.</p>
          <h1>
            Reflections<span>.</span>
          </h1>
          <p className="page-description">
            Thoughts of your own. Words that stay with you.
          </p>
        </div>
        {canEdit && (
          <button className="button primary new-entry" onClick={focusCapture}>
            <Icon name="plus" size={17} /> Capture a thought
          </button>
        )}
      </div>

      {canEdit && (
        <section
          className="composer"
          ref={composer}
          aria-label={editing ? "Edit entry" : "Capture a thought"}
        >
          <div className="composer-top">
            <div className="kind-tabs" role="group" aria-label="Entry type">
              <button
                aria-pressed={kind === "reflection"}
                className={kind === "reflection" ? "selected" : ""}
                onClick={() => setKind("reflection")}
                disabled={busy}
              >
                <Icon name="book" size={16} /> Reflection
              </button>
              <button
                aria-pressed={kind === "quote"}
                className={kind === "quote" ? "selected" : ""}
                onClick={() => setKind("quote")}
                disabled={busy}
              >
                <Icon name="quote" size={16} /> Quote
              </button>
            </div>
            <span className="composer-hint">
              {editing ? "EDITING ENTRY" : "MAKE A LITTLE ROOM FOR A THOUGHT"}
            </span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="sr-only" htmlFor="entry-content">
              {kind === "reflection" ? "Your reflection" : "Quote text"}
            </label>
            <textarea
              id="entry-content"
              ref={textarea}
              placeholder={
                kind === "reflection"
                  ? "What’s on your mind?"
                  : "What words do you want to keep?"
              }
              value={content}
              maxLength={CONTENT_LIMIT}
              disabled={busy}
              onChange={(event) => {
                setContent(event.target.value);
                setStatus("");
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  if (content.trim()) void save();
                }
              }}
            />
            {kind === "quote" && (
              <div className="attribution-field">
                <label htmlFor="attribution">
                  Attribution <span>(optional)</span>
                </label>
                <input
                  id="attribution"
                  placeholder="Author, book, or where you found it"
                  value={attribution}
                  maxLength={300}
                  disabled={busy}
                  onChange={(event) => setAttribution(event.target.value)}
                />
              </div>
            )}
            <div className="composer-footer">
              <span className="capture-note">
                No title needed. Just let it out.
              </span>
              <div className="save-actions">
                {editing && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm("Discard your unsaved changes?"))
                        return;
                      reset();
                    }}
                  >
                    Cancel
                  </button>
                )}
                <span className="keyboard-hint">⌘ / Ctrl + Enter</span>
                <button
                  type="submit"
                  className="button primary"
                  disabled={!content.trim() || busy || !ready}
                >
                  {busy ? "Saving…" : editing ? "Save changes" : "Save thought"}
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
      <div className="feedback" aria-live="polite" role="status">
        {status && (
          <>
            <Icon name="check" size={15} />
            {status}
          </>
        )}
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {storageError && (
        <div className="error-message" role="alert">
          {storageError}{" "}
          <button className="text-button" onClick={() => void refresh()}>
            Retry loading
          </button>
        </div>
      )}

      <section className="collection" aria-labelledby="collection-heading">
        <div className="collection-heading">
          <h2 id="collection-heading">
            Your collection <span>{entries.length}</span>
          </h2>
          {canEdit && (
            <button
              className="text-button export-button"
              onClick={async () => {
                try {
                  await exportReflections(mode);
                  setStatus(
                    "Backup downloaded. Keep this file somewhere safe; it contains your entries.",
                  );
                } catch {
                  setError(
                    "Couldn’t download a backup. Browser storage may be unavailable.",
                  );
                }
              }}
            >
              <Icon name="download" size={15} /> Export backup
            </button>
          )}
        </div>
        <div className="collection-toolbar">
          <div className="filter-tabs" role="group" aria-label="Filter entries">
            {(
              [
                ["all", "All entries", entries.length],
                ["reflection", "Reflections", reflections],
                ["quote", "Quotes", quotes],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
          <label className="search-box">
            <Icon name="search" size={17} />
            <span className="sr-only">Search entries</span>
            <input
              type="search"
              placeholder="Find a thought…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {!ready && !storageError ? (
          <p className="loading-state">Opening your collection…</p>
        ) : ready && visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-art">
              <span />
              <Icon
                name={query || filter !== "all" ? "search" : "book"}
                size={32}
              />
            </div>
            <p className="eyebrow">
              {entries.length
                ? "A LITTLE FURTHER BACK?"
                : "EVERY COLLECTION STARTS SOMEWHERE"}
            </p>
            <h3>
              {entries.length
                ? "No thoughts found."
                : "Leave a thought for your future self."}
            </h3>
            <p>
              {entries.length
                ? "Try a different search or explore all your entries."
                : "A small observation. A sentence you loved. Something you don’t want to forget."}
            </p>
            {entries.length ? (
              <button
                className="text-button empty-cta"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters <Icon name="arrow" size={16} />
              </button>
            ) : canEdit ? (
              <button className="text-button empty-cta" onClick={focusCapture}>
                Capture your first thought <Icon name="arrow" size={16} />
              </button>
            ) : null}
          </div>
        ) : (
          <div className="entry-grid">
            {visible.map((entry) => (
              <article key={entry.id} className={`entry-card ${entry.kind}`}>
                <div className="entry-meta">
                  <span className="entry-kind">
                    <Icon
                      name={entry.kind === "quote" ? "quote" : "book"}
                      size={14}
                    />
                    {entry.kind}
                  </span>
                  <time dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </div>
                {entry.kind === "quote" ? (
                  <blockquote>
                    <p>{entry.content}</p>
                    {entry.attribution && (
                      <footer>— {entry.attribution}</footer>
                    )}
                  </blockquote>
                ) : (
                  <p className="entry-content">{entry.content}</p>
                )}
                <div className="entry-bottom">
                  <span>
                    {entry.updatedAt !== entry.createdAt
                      ? "Edited"
                      : "Kept for later"}
                  </span>
                  {canEdit && (
                    <div>
                      <button
                        className="icon-button"
                        aria-label="Edit entry"
                        title="Edit entry"
                        disabled={busy}
                        onClick={() => edit(entry)}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Delete entry"
                        title="Delete entry"
                        disabled={busy}
                        onClick={() => setPendingDelete(entry.id)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {canEdit && pendingDelete === entry.id && (
                  <div
                    className="delete-confirm"
                    role="group"
                    aria-label="Confirm deletion"
                  >
                    <p>Delete this entry permanently?</p>
                    <div>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => setPendingDelete(undefined)}
                      >
                        Keep it
                      </button>
                      <button
                        className="button danger"
                        disabled={busy}
                        onClick={() => void remove(entry.id)}
                      >
                        Delete entry
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <footer className="page-footer">
        <span>A place to collect, not to perfect.</span>
        <span>
          {mode === "local"
            ? "Saved in this browser only. Export a backup to keep a copy."
            : canEdit
              ? "Only you can add or edit entries."
              : "Open to read. Only the owner can add or edit entries."}
        </span>
      </footer>
    </div>
  );
}
