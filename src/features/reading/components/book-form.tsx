"use client";

import { useId, useRef, useState } from "react";
import {
  BOOK_STATUSES,
  STATUS_LABELS,
  validateBook,
  type Book,
  type BookInput,
  type BookStatus,
} from "../model";
import { Icon } from "@/components/icon";

export function BookForm({
  book,
  disabled,
  onSave,
  onCancel,
}: {
  book?: Book;
  disabled: boolean;
  onSave: (input: BookInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [total, setTotal] = useState(book?.totalPages?.toString() ?? "");
  const [page, setPage] = useState(book?.currentPage.toString() ?? "0");
  const [status, setStatus] = useState<BookStatus>(book?.status ?? "planned");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="reading-form"
      aria-label={book ? `Edit ${book.title}` : "Add a book"}
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || savingRef.current) return;
        setError("");
        let input: BookInput;
        try {
          input = validateBook({
            title,
            author,
            status,
            currentPage: page === "" ? 0 : Number(page),
            totalPages: total === "" ? null : Number(total),
            prerequisiteIds: book?.prerequisiteIds ?? [],
          });
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Check your book details.",
          );
          return;
        }
        savingRef.current = true;
        setSaving(true);
        try {
          await onSave(input);
          if (!book) {
            setTitle("");
            setAuthor("");
            setTotal("");
            setPage("0");
            setStatus("planned");
            titleRef.current?.focus();
          }
        } catch {
          setError(
            "Couldn’t save this book. Your changes are still here. Check your connection or storage and try again.",
          );
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      }}
    >
      <fieldset disabled={disabled || saving}>
        <div className="reading-form-fields">
          <label className="reading-title-field" htmlFor={`${id}-title`}>
            Book title{" "}
            <input
              ref={titleRef}
              id={`${id}-title`}
              name="title"
              placeholder="What’s next on your list?"
              required
              maxLength={300}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label htmlFor={`${id}-author`}>
            Author <span>(optional)</span>
            <input
              id={`${id}-author`}
              name="author"
              placeholder="Who wrote it?"
              maxLength={300}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
            />
          </label>
          <label htmlFor={`${id}-total`}>
            Total pages <span>(optional)</span>
            <input
              id={`${id}-total`}
              name="totalPages"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="e.g. 320"
              value={total}
              onChange={(event) => setTotal(event.target.value)}
            />
          </label>
          {book && (
            <>
              <label htmlFor={`${id}-status`}>
                Reading status
                <select
                  id={`${id}-status`}
                  value={status}
                  onChange={(event) => {
                    const next = event.target.value as BookStatus;
                    setStatus(next);
                    if (next === "planned") setPage("0");
                    if (next === "finished" && total) setPage(total);
                  }}
                >
                  {BOOK_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={`${id}-page`}>
                Current page
                <input
                  autoFocus
                  id={`${id}-page`}
                  name="currentPage"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={total ? Number(total) : undefined}
                  step="1"
                  value={page}
                  onChange={(event) => {
                    setPage(event.target.value);
                    setStatus("reading");
                  }}
                />
              </label>
            </>
          )}
        </div>
        <div className="reading-form-footer">
          <p>
            {book
              ? "Reaching the last page marks this book as finished."
              : "Just a title is enough. Save the details for later."}
          </p>
          <div>
            {onCancel && (
              <button type="button" className="text-button" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={!title.trim()}
            >
              {saving ? "Saving…" : book ? "Save changes" : "Add book"}
              <Icon name={book ? "check" : "plus"} size={16} />
            </button>
          </div>
        </div>
      </fieldset>
      {error && (
        <p className="reading-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
