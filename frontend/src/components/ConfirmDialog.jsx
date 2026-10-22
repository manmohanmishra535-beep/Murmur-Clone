import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";

/**
 * A focused confirmation dialog. It portals to <body> so no layout ancestor can
 * trap it, dims and blurs the page behind it, and locks scrolling while open.
 * Escape or the backdrop cancels; focus starts on Cancel so a stray Enter never
 * confirms a destructive action.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onCancel();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onCancel]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        className="animate-rise w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-2"
      >
        <h2 id="confirm-dialog-title" className="font-display text-xl font-semibold text-ink">
          {title}
        </h2>
        {description ? (
          <p id="confirm-dialog-description" className="mt-2 text-base leading-relaxed text-ink-2">
            {description}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" autoFocus onClick={onCancel} disabled={busy} className="sm:w-auto">
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} loading={busy} onClick={onConfirm} className="sm:w-auto">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
