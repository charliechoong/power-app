"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icon";
import "./image-attachment.css";

export function ImageDisplay({
  id,
  cloudUrl,
  loadLocal,
  caption,
  compact = false,
}: {
  id: string;
  cloudUrl?: string;
  loadLocal?: (id: string) => Promise<Blob | undefined>;
  caption?: string;
  compact?: boolean;
}) {
  const [localUrl, setLocalUrl] = useState("");
  useEffect(() => {
    if (!loadLocal) return;
    let active = true;
    let url = "";
    loadLocal(id)
      .then((blob) => {
        if (!active || !blob) return;
        url = URL.createObjectURL(blob);
        setLocalUrl(url);
      })
      .catch(() => setLocalUrl(""));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, loadLocal]);
  const src = cloudUrl ?? localUrl;
  if (!src)
    return (
      <p className="attached-image-missing">
        Image unavailable on this device.
      </p>
    );
  return (
    <figure className={`attached-image${compact ? " compact" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={caption || "Image attached to entry"}
        loading="lazy"
      />
      {!compact && caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export function ImageAttachmentField({
  id,
  file,
  onFileChange,
  existingImage,
  hasExisting,
  removed,
  onRemoveChange,
  caption,
  onCaptionChange,
  disabled,
}: {
  id: string;
  file?: File;
  onFileChange: (file?: File) => void;
  existingImage?: React.ReactNode;
  hasExisting: boolean;
  removed: boolean;
  onRemoveChange: (removed: boolean) => void;
  caption: string;
  onCaptionChange: (caption: string) => void;
  disabled?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const frame = requestAnimationFrame(() => setPreviewUrl(url));
    return () => {
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  const showingImage = !!file || (hasExisting && !removed);
  return (
    <div className="image-attachment-field">
      <div className="image-attachment-heading">
        <span>
          Image <small>(optional)</small>
        </span>
        <span>One image per entry</span>
      </div>
      <input
        id={id}
        className="sr-only image-file-input"
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(event) => {
          onFileChange(event.target.files?.[0]);
          onRemoveChange(false);
          event.currentTarget.value = "";
        }}
      />
      {showingImage ? (
        <div className="image-attachment-selected">
          <div className="image-attachment-thumb">
            {file && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Selected image preview" />
            ) : (
              existingImage
            )}
          </div>
          <div className="image-attachment-details">
            <strong>{file ? file.name : "Image attached"}</strong>
            <span>
              {file
                ? "Preview · saved when you save this entry"
                : "Saved image"}
            </span>
            <div className="image-attachment-actions">
              <label htmlFor={id} className="image-attachment-action">
                Change image
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onFileChange(undefined);
                  onRemoveChange(hasExisting);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label htmlFor={id} className="image-attachment-empty">
          <span className="image-attachment-icon">
            <Icon name="image" size={21} />
          </span>
          <span>
            <strong>Add an image</strong>
            <small>Choose a photo to remember this moment</small>
          </span>
          <Icon name="plus" size={17} />
        </label>
      )}
      {removed && !file && (
        <p className="image-attachment-note">
          Image will be removed when you save.
        </p>
      )}
      {showingImage && (
        <label className="image-attachment-caption" htmlFor={`${id}-caption`}>
          Caption <span>(optional)</span>
          <input
            id={`${id}-caption`}
            value={caption}
            maxLength={300}
            disabled={disabled}
            onChange={(event) => onCaptionChange(event.target.value)}
            placeholder="A few words about this image"
          />
        </label>
      )}
    </div>
  );
}
