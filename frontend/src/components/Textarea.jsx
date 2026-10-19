import clsx from "clsx";

/** Multi-line companion to Input: same border, focus and error treatment. */
export default function Textarea({
  id,
  label,
  hint,
  error,
  className,
  rows = 4,
  ...props
}) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex w-full flex-col gap-2">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {label}
        </label>
      ) : null}

      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          "w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-base leading-relaxed text-ink transition-colors duration-fast ease-out",
          "placeholder:text-ink-3 hover:border-ink-3 focus:border-accent",
          error ? "border-danger" : "border-line",
          className
        )}
        {...props}
      />

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
