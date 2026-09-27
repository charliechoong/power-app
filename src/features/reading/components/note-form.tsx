"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { NOTE_LIMIT, validateNote, type BookNote } from "../model";

export function NoteForm({
  note,
  disabled,
  onSave,
  onCancel,
}: {
  note?: BookNote;
  disabled: boolean;
  onSave: (content: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const id = useId();
  const [content, setContent] = useState(note?.content ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form
      className="reading-note-form"
      aria-label={note ? "Edit note" : "Add a note"}
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled || savingRef.current) return;
        setError("");
        let clean: string;
        try {
          clean = validateNote(content);
        } catch (reason) {
          setError(
            reason instanceof Error ? reason.message : "Check your note.",
          );
          return;
        }
        savingRef.current = true;
        setSaving(true);
        try {
          await onSave(clean);
          if (!note) {
            setContent("");
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        } catch {
          setError(
            "Couldn’t save this note. Your text is still here. Check your connection and that the book or note still exists.",
          );
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      }}
    >
      <label htmlFor={id}>
        {note ? "Edit note" : "Note or learning point"}
      </label>
      <textarea
        ref={inputRef}
        id={id}
        autoFocus={!!note}
        placeholder="An idea that clicked. A lesson to remember. What will you take away?"
        value={content}
        maxLength={NOTE_LIMIT}
        rows={4}
        disabled={disabled || saving}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="reading-note-form-footer">
        <span>No title needed. ⌘ / Ctrl + Enter to save.</span>
        <div>
          {onCancel && (
            <button
              className="text-button"
              type="button"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={disabled || saving || !content.trim()}
          >
            {saving ? "Saving…" : note ? "Save changes" : "Save note"}
            <Icon name="check" size={15} />
          </button>
        </div>
      </div>
      {error && (
        <p className="reading-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
