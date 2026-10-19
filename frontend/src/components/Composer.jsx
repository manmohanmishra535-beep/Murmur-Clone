import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import Avatar from "./Avatar";
import Button from "./Button";
import CounterRing from "./CounterRing";
import { CloseIcon, ImageIcon } from "./icons";
import { isPostable, remainingCharacters } from "@/lib/composer";
import {
  ALLOWED_IMAGE_LABEL,
  ALLOWED_IMAGE_TYPES,
  MAX_POST_IMAGES,
  validateImageBatch,
} from "@/lib/images";

/**
 * Controlled composer: the page owns the draft text and the selected files so
 * it can survive a failed submit. Up to 4 images, previewed with a remove
 * button and checked against the docs' rules before they are uploaded.
 */
export default function Composer({
  currentUser,
  value,
  onChange,
  images = [],
  onImagesChange,
  onSubmit,
  submitting = false,
  disabled = false,
  allowImages = true,
  onImageError,
  placeholder = "What is happening on your street today?",
  id = "composer-input",
  className,
}) {
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const [previews, setPreviews] = useState([]);

  const remaining = remainingCharacters(value);
  const canPost = isPostable(value, images.length) && !submitting && !disabled;
  const mayAddMore = allowImages && images.length < MAX_POST_IMAGES;
  const addHint = !allowImages
    ? "Images are not available here"
    : mayAddMore
      ? `Add images (up to ${MAX_POST_IMAGES})`
      : `Up to ${MAX_POST_IMAGES} images per post`;

  // Grow with the text up to 320px, then scroll inside the field.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);

  // Object URLs must be revoked, or the blobs leak for the tab's lifetime.
  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  function handleFiles(event) {
    const chosen = Array.from(event.target.files || []);
    event.target.value = "";
    if (chosen.length === 0) return;

    const message = validateImageBatch(chosen, images.length);
    if (message) {
      onImageError?.(message);
      return;
    }
    onImagesChange?.([...images, ...chosen].slice(0, MAX_POST_IMAGES));
  }

  function removeImage(index) {
    onImagesChange?.(images.filter((_file, position) => position !== index));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canPost) return;
    onSubmit?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Write a post"
      className={clsx("border-b border-line bg-surface p-4", className)}
    >
      <div className="grid grid-cols-[44px_1fr] gap-3">
        <Avatar
          size={44}
          src={currentUser?.profileImage}
          name={currentUser?.displayName}
          username={currentUser?.username}
        />

        <div className="min-w-0">
          <label htmlFor={id} className="sr-only">
            Post text
          </label>
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            rows={2}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled || submitting}
            className="w-full resize-none overflow-y-auto bg-transparent text-lg leading-snug text-ink placeholder:text-ink-3 focus:outline-none disabled:cursor-not-allowed"
          />

          {previews.length > 0 ? (
            <div
              className={clsx(
                "mt-3 grid gap-2 overflow-hidden rounded-lg",
                previews.length === 1 ? "grid-cols-1" : "grid-cols-2"
              )}
            >
              {previews.map((preview, index) => (
                <div key={preview} className="relative">
                  {/* A local object URL, so next/image optimisation does not apply. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={`Selected image ${index + 1} preview`}
                    className="max-h-72 w-full rounded-lg border border-line object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={`Remove image ${index + 1}`}
                    className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-pill bg-surface text-ink shadow-1 transition-colors duration-fast hover:bg-surface-2"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                onChange={handleFiles}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!mayAddMore || disabled || submitting}
                title={addHint}
                className="grid h-11 w-11 place-items-center rounded-pill text-accent transition-colors duration-fast hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
              >
                <ImageIcon size={20} />
                <span className="sr-only">{addHint}</span>
              </button>
              {images.length > 0 ? (
                <span className="text-xs text-ink-3" aria-hidden="true">
                  {images.length}/{MAX_POST_IMAGES}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <CounterRing remaining={remaining} />
              <Button type="submit" size="sm" disabled={!canPost} aria-label="Post">
                {submitting ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>

          {allowImages ? (
            <p className="sr-only" id={`${id}-image-hint`}>
              {`Optional images: ${ALLOWED_IMAGE_LABEL}, up to 5 MB each, ${MAX_POST_IMAGES} per post.`}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
