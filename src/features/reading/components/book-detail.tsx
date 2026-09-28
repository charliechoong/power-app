"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { progressPercent, STATUS_LABELS, type Book } from "../model";
import { READING_STORAGE_PREFIX } from "../local-repository";
import { useReadingRepository } from "../client-repository";
import { useStorageMode } from "@/lib/storage-mode";
import { useCanEdit } from "@/lib/edit-access";
import { BookForm } from "./book-form";
import { BookNotes } from "./book-notes";
import "./reading.css";
import "./book-notes.css";

export function BookDetail({ bookId }: { bookId: string }) {
  const readingRepository = useReadingRepository();
  const mode = useStorageMode();
  const canEdit = useCanEdit();
  const [book, setBook] = useState<Book | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [editingBook, setEditingBook] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      readingRepository
        .get(bookId)
        .then((value) => {
          if (active) {
            setBook(value);
            setLoaded(true);
            setError("");
          }
        })
        .catch(() => {
          if (active) {
            setLoaded(true);
            setError(
              "This book couldn’t be loaded. Check your connection and storage, then try again. Your saved data has not been changed.",
            );
          }
        });
    void load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === READING_STORAGE_PREFIX + bookId)
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
  }, [bookId, retry, readingRepository, mode]);

  async function mutate(operation: () => Promise<Book>, success: string) {
    if (!canEdit || busyRef.current || !book || error)
      throw new Error("Book is unavailable.");
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      setBook(await operation());
      setMessage(
        mode === "cloud"
          ? success.replace("on this device", "to your private account")
          : success,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const percent = book ? progressPercent(book) : null;
  return (
    <div className="reading-page reading-detail">
      <Link className="text-button reading-back" href="/reading">
        <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} />
        Back to reading list
      </Link>
      {error && (
        <div className="reading-error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry loading
          </button>
        </div>
      )}
      {!loaded ? (
        <p className="reading-loading">Opening your book…</p>
      ) : !book ? (
        !error && (
          <div className="reading-empty">
            <h1>Book not found</h1>
            <p>
              This book may have been deleted or saved in a different browser.
              Return to your reading list to find your books.
            </p>
          </div>
        )
      ) : (
        <>
          <header className="reading-heading reading-detail-heading">
            <p className="eyebrow">YOUR BOOK. YOUR TAKEAWAYS.</p>
            <h1>{book.title}</h1>
            <p>{book.author || "Author not added"}</p>
          </header>
          <section className="reading-book-summary" aria-label="Book progress">
            <div>
              <span className={`reading-status reading-status-${book.status}`}>
                {STATUS_LABELS[book.status]}
              </span>
              <span>
                {book.totalPages !== null
                  ? `${book.currentPage} of ${book.totalPages} pages`
                  : `Page ${book.currentPage} · total pages not set`}
              </span>
              {percent !== null && <strong>{percent}%</strong>}
            </div>
            {canEdit && (
              <button
                className="text-button"
                disabled={busy || !!error}
                onClick={() => setEditingBook((value) => !value)}
              >
                <Icon name="edit" size={14} />
                {editingBook ? "Close book editor" : "Edit book & progress"}
              </button>
            )}
            {percent !== null && (
              <progress aria-label="Reading progress" value={percent} max={100}>
                {percent}%
              </progress>
            )}
          </section>
          {canEdit && editingBook && (
            <section
              className="reading-capture reading-detail-editor"
              aria-label="Edit book details"
            >
              <BookForm
                book={book}
                disabled={busy || !!error}
                onCancel={() => setEditingBook(false)}
                onSave={async (input) => {
                  await mutate(
                    () => readingRepository.save(input, book),
                    "Book updated on this device.",
                  );
                  setEditingBook(false);
                }}
              />
            </section>
          )}
          <div className="reading-feedback" role="status" aria-live="polite">
            {message && (
              <>
                <Icon name="check" size={15} />
                {message}
              </>
            )}
          </div>
          <BookNotes
            notes={book.notes}
            canEdit={canEdit}
            disabled={busy || !!error}
            onSave={(content, noteId) =>
              mutate(
                () => readingRepository.saveNote(book.id, content, noteId),
                noteId
                  ? "Note updated on this device."
                  : "Note saved on this device.",
              )
            }
            onRemove={(noteId) =>
              mutate(
                () => readingRepository.removeNote(book.id, noteId),
                "Note deleted.",
              )
            }
          />
          <footer className="reading-footer">
            <span>The pages end. The ideas stay with you.</span>
            <span>
              {mode === "local"
                ? "Saved in this browser. Reading backups include your notes."
                : canEdit
                  ? "Only you can update this book and its notes."
                  : "Open to read. Only the owner can update this book."}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}
