"use client";

import "./gratitude.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useStorageMode } from "@/lib/storage-mode";
import { useGratitudeRepository } from "../client-repository";
import { GRATITUDE_STORAGE_PREFIX } from "../local-repository";
import {
  GRATITUDE_CONTENT_LIMIT,
  GRATITUDE_TITLE_LIMIT,
  gratitudeParts,
  type GratitudeEntry,
} from "../model";

function FormattedExperience({ content }: { content: string }) {
  return (
    <span>
      {gratitudeParts(content).map((part, index) =>
        part.bold ? (
          <strong key={index}>{part.text}</strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  );
}

export function GratitudeWorkspace() {
  const repository = useGratitudeRepository();
  const mode = useStorageMode();
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<GratitudeEntry>();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string>();
  const busyRef = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLElement>(null);

  const refresh = useCallback(async () => {
    const items = await repository.list();
    setEntries(items);
    setReady(true);
    setError("");
  }, [repository]);

  useEffect(() => {
    let active = true;
    repository.list().then(
      (items) => {
        if (active) {
          setEntries(items);
          setReady(true);
        }
      },
      () => {
        if (active)
          setError("Could not load gratitude entries. Try refreshing.");
      },
    );
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(GRATITUDE_STORAGE_PREFIX))
        void refresh().catch(() => setError("Could not refresh entries."));
    };
    const onFocus = () => {
      if (mode === "cloud")
        void refresh().catch(() => setError("Could not refresh entries."));
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [repository, mode, refresh]);

  function focusComposer() {
    composer.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textarea.current?.focus({ preventScroll: true });
  }

  function boldSelection() {
    const field = textarea.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selection = content.slice(start, end);
    const replacement = `**${selection}**`;
    if (content.length + 4 > GRATITUDE_CONTENT_LIMIT) return;
    setContent(content.slice(0, start) + replacement + content.slice(end));
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + 2, end + 2);
    });
  }

  async function save() {
    if (busyRef.current || !ready) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const entry = await repository.save({ title, content }, editing);
      setEntries((previous) =>
        [...previous.filter((item) => item.id !== entry.id), entry].sort(
          (a, b) =>
            Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
            a.id.localeCompare(b.id),
        ),
      );
      setContent("");
      setTitle("");
      setEditing(undefined);
      setStatus("Saved to your gratitude collection.");
      textarea.current?.focus();
    } catch (reason) {
      setError(
        reason instanceof Error &&
          /10,000|200 characters|experience/.test(reason.message)
          ? reason.message
          : "Could not save this entry. Your words are still here; please try again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await repository.remove(id);
      setEntries((previous) => previous.filter((entry) => entry.id !== id));
      if (editing?.id === id) {
        setEditing(undefined);
        setContent("");
        setTitle("");
      }
      setPendingDelete(undefined);
      setStatus("Entry deleted.");
    } catch {
      setError("Could not delete this entry. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function edit(entry: GratitudeEntry) {
    if (
      (content.trim() || title.trim() || editing) &&
      !window.confirm("Replace the unsaved text in the writing box?")
    )
      return;
    setEditing(entry);
    setContent(entry.content);
    setTitle(entry.title);
    setError("");
    setStatus("");
    focusComposer();
  }

  const visible = entries.filter((entry) =>
    `${entry.title} ${entry.content}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <div className="gratitude-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MOMENTS WORTH REMEMBERING</p>
          <h1>
            Gratitude<span>.</span>
          </h1>
          <p className="page-description">
            Keep the experiences you are grateful for close.
          </p>
        </div>
        <button className="button primary" onClick={focusComposer}>
          <Icon name="plus" size={17} /> Add an experience
        </button>
      </div>

      <section
        className="gratitude-composer"
        ref={composer}
        aria-label="Write a gratitude entry"
      >
        <div className="gratitude-composer-head">
          <div>
            <p className="eyebrow">YOUR EXPERIENCE</p>
            <h2>
              {editing ? "Edit this memory" : "What are you grateful for?"}
            </h2>
          </div>
          <span>
            {content.length}/{GRATITUDE_CONTENT_LIMIT}
          </span>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="gratitude-title-label" htmlFor="gratitude-title">
            Title <span>(optional)</span>
          </label>
          <input
            id="gratitude-title"
            className="gratitude-title-input"
            value={title}
            maxLength={GRATITUDE_TITLE_LIMIT}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give this memory a name"
          />
          <label className="sr-only" htmlFor="gratitude-content">
            Your grateful experience
          </label>
          <textarea
            id="gratitude-content"
            ref={textarea}
            value={content}
            maxLength={GRATITUDE_CONTENT_LIMIT}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "b"
              ) {
                event.preventDefault();
                boldSelection();
              }
            }}
            placeholder="I still remember when…"
            rows={5}
          />
          <div className="gratitude-toolbar">
            <button
              type="button"
              className="gratitude-bold"
              onClick={boldSelection}
              aria-label="Bold selected text"
              title="Bold selected text (⌘/Ctrl+B)"
            >
              <strong>B</strong> <span>Bold</span>
            </button>
            <span>
              Select words, then tap Bold. **bold** appears in the editor.
            </span>
          </div>
          {content.trim() && (
            <div className="gratitude-preview">
              <span>PREVIEW</span>
              {title.trim() && <h3>{title.trim()}</h3>}
              <p>
                <FormattedExperience content={content} />
              </p>
            </div>
          )}
          <div className="gratitude-composer-foot">
            {editing && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEditing(undefined);
                  setContent("");
                  setTitle("");
                }}
              >
                Cancel edit
              </button>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={busy || !ready || !content.trim()}
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Save experience"}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <p className="gratitude-status" role="status" aria-live="polite">
        {status}
      </p>

      <section
        className="gratitude-collection"
        aria-label="Saved gratitude entries"
      >
        <div className="gratitude-collection-head">
          <h2>
            Experiences <span>{entries.length}</span>
          </h2>
          {entries.length > 0 && (
            <label className="gratitude-search">
              <Icon name="search" size={16} />
              <span className="sr-only">Search experiences</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search memories"
              />
            </label>
          )}
        </div>
        {ready && entries.length === 0 ? (
          <div className="gratitude-empty">
            <Icon name="heart" size={29} />
            <h3>Your collection starts here.</h3>
            <p>
              Write down a moment, big or small, that you are glad happened.
            </p>
          </div>
        ) : ready && visible.length === 0 ? (
          <p className="gratitude-no-results">
            No experiences match that search.
          </p>
        ) : (
          <div className="gratitude-list">
            {visible.map((entry) => (
              <article className="gratitude-card" key={entry.id}>
                <div className="gratitude-card-meta">
                  <span>
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                    }).format(new Date(entry.createdAt))}
                  </span>
                  <Icon name="heart" size={17} />
                </div>
                {entry.title && (
                  <h3 className="gratitude-card-title">{entry.title}</h3>
                )}
                <p>
                  <FormattedExperience content={entry.content} />
                </p>
                <div className="gratitude-card-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => edit(entry)}
                    disabled={busy}
                  >
                    <Icon name="edit" size={15} /> Edit
                  </button>
                  {pendingDelete === entry.id ? (
                    <>
                      <span>Delete this entry?</span>
                      <button
                        type="button"
                        className="text-button gratitude-danger"
                        onClick={() => void remove(entry.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setPendingDelete(undefined)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setPendingDelete(entry.id)}
                      disabled={busy}
                    >
                      <Icon name="trash" size={15} /> Delete
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
