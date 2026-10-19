import clsx from "clsx";
import Image from "next/image";

/** Sizes 32, 44 and 96. Initials fall back to accent-soft. */
const SIZES = {
  32: { box: "h-8 w-8", text: "text-xs" },
  44: { box: "h-11 w-11", text: "text-sm" },
  96: { box: "h-24 w-24", text: "text-xl" },
};

export function initials(name, username) {
  const source = String(name || username || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  src,
  name,
  username,
  size = 44,
  className,
  priority = false,
}) {
  const dims = SIZES[size] || SIZES[44];
  const label = name || username || "User";
  const url = typeof src === "string" ? src : src && src.url;

  if (url) {
    // next/image only accepts remote hosts or local assets; a preview blob URL
    // has to go through a plain <img>.
    const optimizable = /^https?:\/\//.test(url);

    return (
      <span
        className={clsx(
          "relative block shrink-0 overflow-hidden rounded-pill bg-surface-2",
          dims.box,
          className
        )}
      >
        {optimizable ? (
          <Image
            src={url}
            alt={`${label}'s avatar`}
            width={size}
            height={size}
            priority={priority}
            className="h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${label}'s avatar`} className="h-full w-full object-cover" />
        )}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={`${label}'s avatar`}
      className={clsx(
        "grid shrink-0 place-items-center rounded-pill bg-accent-soft font-display font-bold uppercase text-accent",
        dims.box,
        dims.text,
        className
      )}
    >
      {initials(name, username)}
    </span>
  );
}
