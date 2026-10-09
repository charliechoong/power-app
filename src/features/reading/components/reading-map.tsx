"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
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
  readingMapEdgePath,
} from "../map-layout";
import { BookTitle } from "./book-title";

type Drag = {
  sourceId: string;
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  targetId: string | null;
  moved: boolean;
};

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
  const [width, setWidth] = useState(760);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [feedback, setFeedback] = useState<ReactNode>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const selected = books.find((book) => book.id === selectedId);
  const map = useMemo(() => layoutReadingMap(books, width), [books, width]);
  const hasBooks = books.length > 0;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const updateWidth = () => setWidth(frame.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [hasBooks]);

  useEffect(() => {
    if (!drag?.moved) return;
    let animationFrame: number;
    const scrollPage = () => {
      const current = dragRef.current;
      if (!current?.moved) return;
      const edge = 76;
      const speed =
        current.clientY < edge
          ? -Math.min(14, (edge - current.clientY) / 5)
          : current.clientY > window.innerHeight - edge
            ? Math.min(14, (current.clientY - window.innerHeight + edge) / 5)
            : 0;
      if (speed) {
        window.scrollBy(0, speed);
        updateDrag(current.clientX, current.clientY);
      }
      animationFrame = window.requestAnimationFrame(scrollPage);
    };
    animationFrame = window.requestAnimationFrame(scrollPage);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [drag?.moved]);

  function updateDrag(clientX: number, clientY: number) {
    const current = dragRef.current;
    const canvas = canvasRef.current;
    if (!current || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const target = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-reading-book-id]");
    const next: Drag = {
      ...current,
      clientX,
      clientY,
      x: clientX - rect.left,
      y: clientY - rect.top,
      targetId: target?.dataset.readingBookId ?? null,
      moved:
        current.moved ||
        Math.hypot(clientX - current.startX, clientY - current.startY) > 6,
    };
    dragRef.current = next;
    setDrag(next);
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, book: Book) {
    if (!canEdit || disabled || saving || dragRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    if (
      event.pointerType === "touch" &&
      !target.closest(".reading-map-drag-handle")
    )
      return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next: Drag = {
      sourceId: book.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      targetId: null,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
    setFeedback(null);
  }

  async function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    updateDrag(event.clientX, event.clientY);
    const finished = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (
      !finished?.moved ||
      !finished.targetId ||
      finished.targetId === finished.sourceId
    )
      return;
    const target = books.find((book) => book.id === finished.targetId);
    const source = books.find((book) => book.id === finished.sourceId);
    if (!target || !source || target.prerequisiteIds.includes(source.id))
      return;
    const prerequisiteIds = [...target.prerequisiteIds, source.id];
    try {
      validateReadingOrder(books, target.id, prerequisiteIds);
      setSaving(true);
      await onSave({ ...target, prerequisiteIds }, target);
      setFeedback(
        <>
          <BookTitle title={source.title} /> is now suggested before{" "}
          <BookTitle title={target.title} />.
        </>,
      );
    } catch (reason) {
      setFeedback(
        reason instanceof Error
          ? reason.message
          : "Couldn’t save this connection.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!hasBooks) return null;

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
            {canEdit && " Drag one book onto another to connect them."}
          </p>
        </div>
        <span className="reading-map-count">
          {map.edges.length}{" "}
          {map.edges.length === 1 ? "connection" : "connections"}
        </span>
      </div>
      <div ref={frameRef} className="reading-map-frame">
        <div
          ref={canvasRef}
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
              return (
                <path
                  key={`${source.book.id}-${target.book.id}`}
                  d={readingMapEdgePath(source, target, map.nodeWidth)}
                  className={
                    source.book.status === "finished"
                      ? "reading-map-edge done"
                      : "reading-map-edge"
                  }
                  markerEnd="url(#reading-map-arrow)"
                />
              );
            })}
            {drag?.moved &&
              (() => {
                const source = map.nodes.find(
                  (node) => node.book.id === drag.sourceId,
                );
                if (!source) return null;
                const x1 = source.x + map.nodeWidth / 2;
                const y1 = source.y + MAP_NODE_HEIGHT / 2;
                return (
                  <path
                    className="reading-map-preview-edge"
                    d={`M ${x1} ${y1} L ${drag.x} ${drag.y}`}
                  />
                );
              })()}
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
                data-reading-book-id={book.id}
                className={`reading-map-node reading-map-node-${book.status}${drag?.moved && drag.sourceId === book.id ? " is-dragging" : ""}${drag?.moved && drag.targetId === book.id && drag.sourceId !== book.id ? " is-drop-target" : ""}`}
                style={{
                  left: x,
                  top: y,
                  width: map.nodeWidth,
                  height: MAP_NODE_HEIGHT,
                }}
                onPointerDown={(event) => startDrag(event, book)}
                onPointerMove={(event) => {
                  if (dragRef.current?.pointerId === event.pointerId) {
                    updateDrag(event.clientX, event.clientY);
                  }
                }}
                onPointerUp={finishDrag}
                onPointerCancel={() => {
                  dragRef.current = null;
                  setDrag(null);
                }}
              >
                <div className="reading-map-node-top">
                  <span className="reading-map-node-status">
                    {STATUS_LABELS[book.status]}
                  </span>
                  {canEdit && (
                    <span
                      className="reading-map-drag-handle"
                      title="Drag onto another book to connect"
                    >
                      <Icon name="move" size={12} /> Drag
                    </span>
                  )}
                </div>
                <Link
                  href={`/reading/${encodeURIComponent(book.id)}`}
                  title={`Open ${book.title}`}
                >
                  <BookTitle title={book.title} />
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
      {feedback && (
        <p className="reading-map-drop-feedback" role="status">
          {feedback}
        </p>
      )}
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
              <h3>
                Before <BookTitle title={selected.title} />
              </h3>
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
                  <span>
                    <BookTitle title={book.title} />
                  </span>
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
