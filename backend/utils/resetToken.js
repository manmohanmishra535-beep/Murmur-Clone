"use strict";

const crypto = require("crypto");

/** How long an emailed link works. Long enough to check mail, short enough to be safe. */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * The token that travels in the link is random and is never stored. The
 * database keeps only its SHA-256 hash, which is enough to verify a link and
 * useless to anyone who reads the collection.
 */
function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function createResetToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
}

module.exports = { createResetToken, hashResetToken, RESET_TOKEN_TTL_MS };
