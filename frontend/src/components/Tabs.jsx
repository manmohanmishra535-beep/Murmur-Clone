import { useRef } from "react";
import clsx from "clsx";

/**
 * 48px tall, 4px accent underline on the active tab.
 * Arrow keys move the selection, matching the tablist pattern.
 */
export default function Tabs({ items, value, onChange, label = "Tabs", className }) {
  const refs = useRef([]);

  function handleKeyDown(event, index) {
    const isNext = event.key === "ArrowRight";
    const isPrev = event.key === "ArrowLeft";
    const isHome = event.key === "Home";
    const isEnd = event.key === "End";
    if (!isNext && !isPrev && !isHome && !isEnd) return;

    event.preventDefault();
    let next = index;
    if (isNext) next = (index + 1) % items.length;
    if (isPrev) next = (index - 1 + items.length) % items.length;
    if (isHome) next = 0;
    if (isEnd) next = items.length - 1;

    refs.current[next]?.focus();
    onChange(items[next].key);
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={clsx("flex h-12 border-b border-line", className)}
    >
      {items.map((item, index) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={clsx(
              "relative flex flex-1 items-center justify-center gap-2 font-display text-base font-semibold transition-colors duration-fast ease-out",
              active ? "text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
            )}
          >
            {item.label}
            {item.count != null ? (
              <span className="tabular text-xs font-normal text-ink-3">{item.count}</span>
            ) : null}
            <span
              aria-hidden="true"
              className={clsx(
                "absolute inset-x-0 bottom-0 mx-auto h-1 rounded-pill bg-accent transition-transform duration-base ease-out",
                active ? "scale-x-100" : "scale-x-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
