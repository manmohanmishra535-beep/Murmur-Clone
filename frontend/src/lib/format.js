/**
 * Counts use compact units above 9,999 and tabular numerals in the UI.
 * 1,284 -> "1,284"  10,200 -> "10.2K"  1,250,000 -> "1.3M"
 */
function trimUnit(value) {
  if (value >= 100) return String(Math.round(value));
  return value.toFixed(1).replace(/\.0$/, "");
}

export function compactNumber(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);

  if (abs < 10000) return n.toLocaleString("en-US");

  if (abs < 1_000_000) {
    const thousands = n / 1000;
    if (Math.round(thousands) >= 1000) return "1M";
    return `${trimUnit(Math.abs(thousands)) * Math.sign(n)}K`;
  }

  const millions = n / 1_000_000;
  return `${trimUnit(Math.abs(millions)) * Math.sign(n)}M`;
}

/** "now", "5m", "2h", "3d", then a calendar date. */
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** The profile header line: "Joined March 2024". */
export function joinedDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `Joined ${date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}
