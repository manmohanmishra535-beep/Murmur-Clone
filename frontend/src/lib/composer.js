/**
 * Composer math, kept out of the component so it can be tested directly.
 * The ring turns amber at 20 characters left and red below 0.
 */

export const POST_MAX = 280;
export const RING_WARN_AT = 20;
export const RING_RADIUS = 9;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function remainingCharacters(text) {
  return POST_MAX - String(text || "").length;
}

/** "normal" | "warn" | "danger" */
export function counterTone(remaining) {
  if (remaining < 0) return "danger";
  if (remaining <= RING_WARN_AT) return "warn";
  return "normal";
}

/** Stroke offset for the ring: 0 when full, circumference when empty. */
export function ringOffset(remaining, circumference = RING_CIRCUMFERENCE) {
  const progress = Math.min(1, Math.max(0, remaining / POST_MAX));
  return circumference * (1 - progress);
}

export function isPostable(text) {
  const length = String(text || "").trim().length;
  return length > 0 && length <= POST_MAX;
}
