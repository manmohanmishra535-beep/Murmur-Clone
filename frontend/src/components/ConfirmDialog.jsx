import { useEffect } from "react";
import Button from "./Button";

/**
 * A small, accessible confirmation dialog. Escape or the backdrop cancels;
 * focus starts on Cancel so a stray Enter never confirms a destructive action.
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
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
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
        className="w-full max-w-sm rounded-lg border border-line bg-surface p-5 shadow-2"
      >
        <h2 id="confirm-dialog-title" className="font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        {description ? (
          <p id="confirm-dialog-description" className="mt-2 text-sm text-ink-2">
            {description}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" autoFocus onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
