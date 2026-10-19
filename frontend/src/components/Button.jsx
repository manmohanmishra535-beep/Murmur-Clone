import clsx from "clsx";

/**
 * 40px (md) or 32px (sm) tall. One primary button per view.
 * Disabled is a visual state, never a hidden one.
 */
const VARIANTS = {
  primary:
    "bg-accent text-accent-ink hover:brightness-105 active:scale-[0.99] shadow-1",
  secondary:
    "bg-surface-2 text-ink border border-line hover:bg-line active:scale-[0.99]",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110 active:scale-[0.99]",
};

const SIZES = {
  md: "h-10 px-4 text-base",
  sm: "h-8 px-3 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  loading = false,
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 rounded-pill font-body font-semibold",
        "transition-[background-color,color,transform,filter,opacity] duration-fast ease-out",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin-fast rounded-pill border-2 border-current border-r-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
