import clsx from "clsx";

/** A form-level message: one line, announced once, never colour alone. */
export default function FormAlert({ tone = "error", children }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error"
          ? "border-danger/30 bg-danger/5 text-danger"
          : "border-line bg-surface-2 text-ink-2"
      )}
    >
      {children}
    </p>
  );
}
