import clsx from "clsx";

/**
 * 44px tall, accent focus treatment, error text under the field.
 * The hint and the error share one describedby so a screen reader always
 * hears the current message.
 */
export default function Input({
  id,
  label,
  hint,
  error,
  leading,
  trailing,
  className,
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

      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
            {leading}
          </span>
        ) : null}

        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(
            "h-11 w-full rounded-md border bg-surface px-3 text-base text-ink transition-colors duration-fast ease-out",
            "placeholder:text-ink-3 hover:border-ink-3 focus:border-accent",
            error ? "border-danger" : "border-line",
            leading ? "pl-10" : null,
            trailing ? "pr-10" : null,
            className
          )}
          {...props}
        />

        {trailing ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>
        ) : null}
      </div>

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
