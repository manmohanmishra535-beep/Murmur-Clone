"use strict";

const mongoose = require("mongoose");
const AppError = require("./AppError");

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

/**
 * Build the Mongo filter fragment for a cursor. A cursor arrives as a query
 * string, so it is checked before it reaches Mongo: a malformed one is bad
 * input and gets the same 422 every other bad field gets, instead of a cast
 * error that would surface as a 500.
 */
function cursorFilter(cursor) {
  if (!cursor) return {};
  if (!mongoose.isValidObjectId(cursor)) {
    throw AppError.validation("That page cursor is not valid.", {
      cursor: "Refresh the page and try again.",
    });
  }
  return { _id: { $lt: cursor } };
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, parseLimit, paginate, cursorFilter };
