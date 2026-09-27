"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import {
  BOOK_STATUSES,
  STATUS_LABELS,
  filterBooks,
  type Book,
  type BookInput,
  type BookStatus,
} from "../model";
import { READING_STORAGE_PREFIX } from "../local-repository";
import { useReadingRepository, exportReading } from "../client-repository";
import { useStorageMode } from "@/lib/storage-mode";
import { BookForm } from "./book-form";
import { BookCard } from "./book-card";
import "./reading.css";

export function ReadingWorkspace() {
  const readingRepository = useReadingRepository();
  const mode = useStorageMode();
  const [books, setBooks] = useState<Book[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [message, setMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [filter, setFilter] = useState<BookStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      readingRepository
        .list()
        .then((items) => {
          if (active) {
            setBooks(items);
            setReady(true);
            setStorageError("");
          }
        })
        .catch((reason) => {
          if (active) {
            setStorageError(
              reason instanceof Error
                ? reason.message
                : "Browser storage is unavailable.",
            );
            setReady(false);
          }
        });
    void load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(READING_STORAGE_PREFIX))
        void load();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => {
      if (mode === "cloud") void load();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [retry, readingRepository, mode]);

  async function save(input: BookInput, existing?: Book) {
    if (!ready || busyRef.current) throw new Error("Storage is not ready.");
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const book = await readingRepository.save(input, existing);
      setBooks((previous) =>
        existing
          ? previous.map((item) => (item.id === book.id ? book : item))
          : [book, ...previous],
      );
      setMessage(
        mode === "cloud"
          ? "Book saved to your private account."
          : existing
            ? "Book updated on this device."
            : "Book added to your reading list.",
      );
      // A new addition should remain visible even when a different shelf was selected.
      if (!existing) {
        setFilter("all");
        setQuery("");
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!ready || busyRef.current) throw new Error("Storage is not ready.");
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await readingRepository.remove(id);
      setBooks((previous) => previous.filter((book) => book.id !== id));
      setMessage("Book deleted.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const visible = filterBooks(books, filter, query);
  return (
    <div className="reading-page">
      <header className="reading-heading">
        <p className="eyebrow">ONE BOOK. A FEW PAGES. YOUR OWN PACE.</p>
        <h1>
          Reading list<span>.</span>
        </h1>
        <p>Make room for your next read. Pick up where you left off.</p>
      </header>
      <section
        className="reading-capture"
        aria-labelledby="reading-add-heading"
      >
        <div className="reading-capture-heading">
          <Icon name="plus" size={18} />
          <h2 id="reading-add-heading">A book to come back to</h2>
        </div>
        <BookForm disabled={!ready || busy} onSave={save} />
      </section>
      <div className="reading-feedback" role="status" aria-live="polite">
        {message && (
          <>
            <Icon name="check" size={15} />
            {message}
          </>
        )}
      </div>
      {storageError && (
        <div className="reading-error" role="alert">
          {storageError}
          <button
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry loading
          </button>
        </div>
      )}
      <section aria-labelledby="reading-shelf-heading">
        <div className="reading-shelf-heading">
          <h2 id="reading-shelf-heading">
            Your bookshelf <span>{books.length}</span>
          </h2>
          <button
            className="text-button"
            onClick={async () => {
              setExportError("");
              try {
                await exportReading(mode);
                setMessage(
                  "Reading backup downloaded. Keep it somewhere safe.",
                );
              } catch {
                setExportError(
                  "Couldn’t export your books. Browser storage may be unavailable.",
                );
              }
            }}
          >
            <Icon name="download" size={15} />
            Export backup
          </button>
        </div>
        {exportError && (
          <p className="reading-error" role="alert">
            {exportError}
          </p>
        )}
        <div className="reading-toolbar">
          <div
            className="reading-filters"
            role="group"
            aria-label="Filter books"
          >
            {(["all", ...BOOK_STATUSES] as const).map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "All books" : STATUS_LABELS[value]}
                <span>
                  {value === "all"
                    ? books.length
                    : books.filter((book) => book.status === value).length}
                </span>
              </button>
            ))}
          </div>
          <label className="reading-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Search books</span>
            <input
              type="search"
              placeholder="Find a book or author…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {!ready ? (
          <p className="reading-loading">
            {storageError
              ? "Your bookshelf will appear once storage is available."
              : "Opening your bookshelf…"}
          </p>
        ) : visible.length ? (
          <div className="reading-books">
            {visible.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                disabled={busy || !ready}
                onSave={save}
                onRemove={remove}
              />
            ))}
          </div>
        ) : (
          <div className="reading-empty">
            <span className="reading-empty-icon">
              <Icon name="book" size={32} />
            </span>
            <p className="eyebrow">
              {books.length
                ? "FIND YOUR NEXT CHAPTER"
                : "SO MANY WORLDS TO STEP INTO"}
            </p>
            <h3>
              {books.length
                ? "No books here yet."
                : "Your next chapter starts here."}
            </h3>
            <p>
              {books.length
                ? "Try another shelf or search for a different title or author."
                : "Add a book you’ve been meaning to read. A few pages at a time is plenty."}
            </p>
            {books.length > 0 && (
              <button
                className="text-button"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Show all books
                <Icon name="arrow" size={15} />
              </button>
            )}
          </div>
        )}
      </section>
      <footer className="reading-footer">
        <span>A few pages today. A different perspective tomorrow.</span>
        <span>
          {mode === "cloud"
            ? "Saved to your private account. Export a backup to keep a copy."
            : "Saved in this browser only. Export a backup to keep a copy."}
        </span>
      </footer>
    </div>
  );
}
