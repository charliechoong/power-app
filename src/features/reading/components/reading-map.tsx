"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  progressPercent,
  STATUS_LABELS,
  validateReadingOrder,
  type Book,
  type BookInput,
} from "../model";
import {
  layoutReadingMap,
  MAP_NODE_HEIGHT,
  MAP_NODE_WIDTH,
} from "../map-layout";

export function ReadingMap({
  books,
  canEdit,
  disabled,
  onSave,
}: {
  books: Book[];
  canEdit: boolean;
  disabled: boolean;
  onSave: (input: BookInput, existing: Book) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = books.find((book) => book.id === selectedId);
  const map = layoutReadingMap(books);

  if (!books.length) return null;

  return (
    <section
      className="reading-map-section"
      aria-labelledby="reading-map-heading"
    >
      <div className="reading-map-heading">
        <div>
          <p className="eyebrow">SEE HOW YOUR READING CONNECTS</p>
          <h2 id="reading-map-heading">Reading map</h2>
          <p>
            Arrows mean “read first.” This is a suggested order; you can start
            any book whenever you like.
          </p>
        </div>
        <span className="reading-map-count">
          {map.edges.length}{" "}
          {map.edges.length === 1 ? "connection" : "connections"}
        </span>
      </div>
      <div
        className="reading-map-scroll"
        role="region"
        aria-label="Reading map"
        tabIndex={0}
      >
        <div
          className="reading-map-canvas"
          style={{ width: map.width, height: map.height }}
        >
          <svg
            className="reading-map-lines"
            width={map.width}
            height={map.height}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="reading-map-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" fill="#9baf88" />
              </marker>
            </defs>
            {map.edges.map(({ source, target }) => {
              const x1 = source.x + MAP_NODE_WIDTH + 3;
              const y1 = source.y + MAP_NODE_HEIGHT / 2;
              const x2 = target.x - 10;
              const y2 = target.y + MAP_NODE_HEIGHT / 2;
              const bend = Math.max(28, (x2 - x1) / 2);
              return (
                <path
                  key={`${source.book.id}-${target.book.id}`}
                  d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                  className={
                    source.book.status === "finished"
                      ? "reading-map-edge done"
                      : "reading-map-edge"
                  }
                  markerEnd="url(#reading-map-arrow)"
                />
              );
            })}
          </svg>
          {map.nodes.map(({ book, x, y }) => {
            const earlierBooks = book.prerequisiteIds.flatMap((id) => {
              const earlier = books.find((item) => item.id === id);
              return earlier ? [earlier] : [];
            });
            const completed = earlierBooks.filter(
              (item) => item.status === "finished",
            ).length;
            const percent = progressPercent(book);
            return (
              <div
                key={book.id}
                className={`reading-map-node reading-map-node-${book.status}`}
                style={{
                  left: x,
                  top: y,
                  width: MAP_NODE_WIDTH,
                  height: MAP_NODE_HEIGHT,
                }}
              >
                <span className="reading-map-node-status">
                  {STATUS_LABELS[book.status]}
                </span>
                <Link
                  href={`/reading/${encodeURIComponent(book.id)}`}
                  title={`Open ${book.title}`}
                >
                  {book.title}
                </Link>
                <span className="reading-map-node-meta">
                  {earlierBooks.length
                    ? `${completed}/${earlierBooks.length} earlier books finished`
                    : book.author || "No earlier books"}
                </span>
                <div className="reading-map-node-footer">
                  <span>
                    {percent === null
                      ? book.status === "reading"
                        ? "In progress"
                        : ""
                      : `${percent}% read`}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={disabled || saving}
                      aria-label={`Set reading order for ${book.title}`}
                      onClick={() => {
                        setSelectedId(book.id);
                        setDraft(earlierBooks.map((item) => item.id));
                        setError("");
                      }}
                    >
                      Set order <Icon name="arrow" size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="reading-map-hint">
        Scroll the map to explore all your books.
      </p>
      {canEdit && selected && (
        <form
          className="reading-map-editor"
          aria-label={`Reading order for ${selected.title}`}
          onSubmit={async (event) => {
            event.preventDefault();
            if (disabled || saving) return;
            setError("");
            try {
              validateReadingOrder(books, selected.id, draft);
              setSaving(true);
              await onSave({ ...selected, prerequisiteIds: draft }, selected);
              setSelectedId(null);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Couldn’t save the reading order.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="reading-map-editor-heading">
            <div>
              <h3>Before {selected.title}</h3>
              <p>
                Choose books you’d like to finish first. You can still read this
                book at any time.
              </p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </div>
          <div className="reading-map-options">
            {books
              .filter((book) => book.id !== selected.id)
              .map((book) => (
                <label key={book.id}>
                  <input
                    type="checkbox"
                    checked={draft.includes(book.id)}
                    onChange={(event) =>
                      setDraft((current) =>
                        event.target.checked
                          ? [...current, book.id]
                          : current.filter((id) => id !== book.id),
                      )
                    }
                  />
                  <span>{book.title}</span>
                  <small>{STATUS_LABELS[book.status]}</small>
                </label>
              ))}
          </div>
          {books.length === 1 && (
            <p>Add another book to create a connection.</p>
          )}
          {error && (
            <p className="reading-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={disabled || saving}
          >
            {saving ? "Saving…" : "Save reading order"}
          </button>
        </form>
      )}
    </section>
  );
}
