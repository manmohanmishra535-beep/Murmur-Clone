"use strict";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Clamp ?limit= to 1..50, defaulting to 20. */
function parseLimit(raw, fallback = DEFAULT_LIMIT) {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 1) return fallback;
  return Math.min(value, MAX_LIMIT);
}

/**
 * Cursor pagination: fetch limit + 1 rows, and if the extra row exists, hand
 * back its id as the cursor. ObjectIds grow with time, so { _id: { $lt: cursor } }
 * is a stable "next page" filter that new posts cannot shift.
 */
function paginate(docs, limit) {
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;
  return { items, nextCursor, hasMore };
}

/** Build the Mongo filter fragment for a cursor. */
function cursorFilter(cursor) {
  return cursor ? { _id: { $lt: cursor } } : {};
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, parseLimit, paginate, cursorFilter };
