import { useEffect, useRef } from "react";
import clsx from "clsx";
import Avatar from "./Avatar";
import Button from "./Button";
import { CloseIcon, ImageIcon } from "./icons";
import {
  counterTone,
  isPostable,
  remainingCharacters,
  ringOffset,
  RING_CIRCUMFERENCE,
} from "@/lib/composer";

const TONE_COLOR = {
  normal: "var(--ink-3)",
  warn: "var(--warn)",
  danger: "var(--danger)",
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Ring counter: full at 280 remaining, amber at 20, red below 0.
 * The number is announced politely; the post button is disabled, never hidden,
 * when the draft is empty or over the limit.
 */
function CounterRing({ remaining }) {
  const tone = counterTone(remaining);
  const color = TONE_COLOR[tone];
  const showNumber = remaining <= 20;

  return (
    <span className="relative grid h-8 w-8 place-items-center">
      <svg width="32" height="32" viewBox="0 0 24 24" className="-rotate-90" aria-hidden="true">
        <circle cx="12" cy="12" r={9} fill="none" stroke="var(--line)" strokeWidth="2.5" />
        <circle
          cx="12"
          cy="12"
          r={9}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={ringOffset(remaining)}
          className="transition-[stroke-dashoffset,stroke] duration-base ease-out"
        />
      </svg>
      <span
        aria-hidden="true"
        className={clsx("absolute font-mono text-[10px] font-medium tabular", !showNumber && "sr-only")}
        style={{ color }}
      >
        {showNumber ? remaining : ""}
      </span>
      <span className="sr-only" aria-live="polite">
        {remaining < 0
          ? `${Math.abs(remaining)} characters over the limit`
          : `${remaining} characters remaining`}
      </span>
    </span>
  );
}

export default function Composer({
  currentUser,
  value,
  onChange,
  onSubmit,
  submitting = false,
  disabled = false,
  allowImages = false,
  imagePreview,
  onPickImage,
  onRemoveImage,
  onImageError,
  placeholder = "What is happening on your street today?",
  id = "composer-input",
  className,
}) {
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const remaining = remainingCharacters(value);
  const canPost = isPostable(value) && !submitting && !disabled;

  // Grow with the text up to 320px, then scroll inside the field.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);

  function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      onImageError?.("Use a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onImageError?.("Images must be 5 MB or smaller.");
      return;
    }
    onPickImage?.(file);
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

          {imagePreview ? (
            <div className="relative mt-3 overflow-hidden rounded-lg border border-line">
              {/* A local object URL, so next/image optimisation does not apply. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Selected image preview" className="max-h-72 w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage?.()}
                aria-label="Remove image"
                className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-pill bg-surface text-ink shadow-1 transition-colors duration-fast hover:bg-surface-2"
              >
                <CloseIcon size={18} />
              </button>
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                onChange={handleFile}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!allowImages || disabled || submitting}
                title={allowImages ? "Add an image" : "Images arrive with Phase 2"}
                className="grid h-11 w-11 place-items-center rounded-pill text-accent transition-colors duration-fast hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
              >
                <ImageIcon size={20} />
                <span className="sr-only">
                  {allowImages ? "Add an image" : "Add an image (available in Phase 2)"}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <CounterRing remaining={remaining} />
              <Button type="submit" size="sm" disabled={!canPost} aria-label="Post">
                {submitting ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
