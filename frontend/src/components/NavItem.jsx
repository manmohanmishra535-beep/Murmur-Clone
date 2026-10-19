import Link from "next/link";
import clsx from "clsx";

/**
 * 48px tall, display font. The unread badge sits in accent and keeps its
 * own accessible label so the count is never colour-only information.
 */
export default function NavItem({
  icon: Icon,
  label,
  href,
  active = false,
  badge = 0,
  collapsible = false,
  onClick,
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={collapsible ? label : undefined}
      className={clsx(
        "group flex h-12 items-center gap-3 rounded-pill px-3 font-display text-lg font-semibold transition-colors duration-fast ease-out",
        collapsible && "justify-center lg:justify-start",
        active
          ? "bg-accent-soft text-accent"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      )}
    >
      <span className="relative shrink-0">
        <Icon size={24} />
        {badge > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-accent px-1 font-body text-[10px] font-bold leading-none text-accent-ink tabular"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>

      <span className={clsx("truncate", collapsible && "hidden lg:inline")}>{label}</span>
      {badge > 0 ? <span className="sr-only">, {badge} unread</span> : null}
    </Link>
  );
}
