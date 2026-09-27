"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import type { BookNote } from "../model";
import { NoteForm } from "./note-form";

export function BookNotes({
  notes,
  disabled,
  onSave,
  onRemove,
}: {
  notes: BookNote[];
  disabled: boolean;
  onSave: (content: string, noteId?: string) => Promise<void>;
  onRemove: (noteId: string) => Promise<void>;
}) {
  return (
    <section aria-labelledby="book-notes-heading">
      <div className="reading-shelf-heading">
        <h2 id="book-notes-heading">
          Notes & learning points <span>{notes.length}</span>
        </h2>
      </div>
      <div className="reading-capture">
        <NoteForm disabled={disabled} onSave={(content) => onSave(content)} />
      </div>
      {notes.length === 0 ? (
        <div className="reading-notes-empty">
          <Icon name="book" size={25} />
          <h3>Keep more than the last page.</h3>
          <p>
            Capture a useful idea, a question, or something you’d like to put
            into practice.
          </p>
        </div>
      ) : (
        <div className="reading-note-list">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              disabled={disabled}
              onSave={(content) => onSave(content, note.id)}
              onRemove={() => onRemove(note.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NoteCard({
  note,
  disabled,
  onSave,
  onRemove,
}: {
  note: BookNote;
  disabled: boolean;
  onSave: (content: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  return (
    <article className="reading-note" aria-label="Book note">
      <div className="reading-note-meta">
        <time dateTime={note.createdAt}>
          {new Date(note.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
        {note.updatedAt !== note.createdAt && <span>Edited</span>}
      </div>
      {editing ? (
        <NoteForm
          note={note}
          disabled={disabled}
          onCancel={() => setEditing(false)}
          onSave={async (content) => {
            await onSave(content);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <p className="reading-note-content">{note.content}</p>
          <div className="reading-note-actions">
            <button
              className="text-button"
              disabled={disabled}
              onClick={() => setEditing(true)}
            >
              <Icon name="edit" size={14} />
              Edit note
            </button>
            <button
              className="text-button"
              disabled={disabled}
              onClick={() => setConfirmDelete(true)}
            >
              <Icon name="trash" size={14} />
              Delete note
            </button>
          </div>
        </>
      )}
      {confirmDelete && (
        <div
          className="reading-delete"
          role="group"
          aria-label="Confirm note deletion"
        >
          <p>Delete this note permanently?</p>
          <div>
            <button
              className="text-button"
              disabled={disabled}
              onClick={() => setConfirmDelete(false)}
            >
              Keep note
            </button>
            <button
              className="button danger"
              disabled={disabled}
              onClick={async () => {
                setError("");
                try {
                  await onRemove();
                } catch {
                  setError("Couldn’t delete this note. Please try again.");
                }
              }}
            >
              Delete permanently
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
