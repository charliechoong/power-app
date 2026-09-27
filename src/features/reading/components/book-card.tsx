"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  progressPercent,
  STATUS_LABELS,
  type Book,
  type BookInput,
} from "../model";
import { BookForm } from "./book-form";

export function BookCard({
  book,
  disabled,
  onSave,
  onRemove,
}: {
  book: Book;
  disabled: boolean;
  onSave: (input: BookInput, existing: Book) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const percent = progressPercent(book);

  async function startReading() {
    setBusy(true);
    setError("");
    try {
      await onSave({ ...book, status: "reading" }, book);
    } catch {
      setError(
        "Couldn’t update progress. Please try again; browser storage may be unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`reading-book reading-book-${book.status}`}
      aria-label={book.title}
    >
      <div className="reading-book-heading">
        <span className={`reading-status reading-status-${book.status}`}>
          {book.status === "finished" && <Icon name="check" size={13} />}
          {STATUS_LABELS[book.status]}
        </span>
        <button
          className="icon-button"
          aria-label={`Delete ${book.title}`}
          title="Delete book"
          disabled={disabled || busy}
          onClick={() => setConfirmDelete(true)}
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
      <div className="reading-book-info">
        <div className="reading-book-mark" aria-hidden="true">
          <Icon name="book" size={25} />
        </div>
        <div>
          <h3>
            <Link
              className="reading-book-title-link"
              href={`/reading/${encodeURIComponent(book.id)}`}
            >
              {book.title}
            </Link>
          </h3>
          <p>{book.author || "Author not added"}</p>
        </div>
      </div>
      <div className="reading-progress">
        <div>
          <span>
            {book.totalPages !== null
              ? `${book.currentPage} of ${book.totalPages} pages`
              : book.status === "finished"
                ? "Finished · total pages not set"
                : `Page ${book.currentPage} · total pages not set`}
          </span>
          {percent !== null && <strong>{percent}%</strong>}
        </div>
        {percent !== null ? (
          <progress
            aria-label={`Reading progress for ${book.title}`}
            value={percent}
            max={100}
          >
            {percent}%
          </progress>
        ) : (
          <p className="reading-progress-hint">
            Add total pages to see your progress percentage.
          </p>
        )}
      </div>
      <Link
        className="reading-notes-link"
        href={`/reading/${encodeURIComponent(book.id)}`}
      >
        <Icon name="book" size={15} />
        View notes <span>{book.notes.length}</span>
        <Icon name="arrow" size={15} />
      </Link>
      {!editing && (
        <div className="reading-book-actions">
          <button
            className="text-button"
            disabled={disabled || busy}
            onClick={() => {
              setEditing(true);
              setError("");
            }}
          >
            <Icon name="edit" size={14} />
            {book.status === "planned" ? "Edit book" : "Update progress"}
          </button>
          {book.status === "planned" && (
            <button
              className="button reading-start"
              disabled={disabled || busy}
              onClick={() => void startReading()}
            >
              Start reading
              <Icon name="arrow" size={14} />
            </button>
          )}
        </div>
      )}
      {editing && (
        <BookForm
          book={book}
          disabled={disabled || busy}
          onCancel={() => setEditing(false)}
          onSave={async (input) => {
            await onSave(input, book);
            setEditing(false);
          }}
        />
      )}
      {confirmDelete && (
        <div
          className="reading-delete"
          role="group"
          aria-label={`Confirm deletion of ${book.title}`}
        >
          <p>Delete this book, its progress, and all its notes?</p>
          <div>
            <button
              className="text-button"
              disabled={disabled || busy}
              onClick={() => setConfirmDelete(false)}
            >
              Keep book
            </button>
            <button
              className="button danger"
              disabled={disabled || busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await onRemove(book.id);
                } catch {
                  setError("Couldn’t delete this book. Please try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete book
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="reading-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
