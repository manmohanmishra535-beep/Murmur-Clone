"use strict";

const jwt = require("jsonwebtoken");
const config = require("../config/env");

const COOKIE_NAME = "token";

/** HS256 token carrying the user id and the password generation it belongs to. */
function signToken(user) {
  // Callers normally pass the document; a bare id is still accepted and is
  // treated as the first password generation, which keeps old tests honest.
  const isDocument = Boolean(user) && typeof user === "object" && user._id !== undefined;
  const id = isDocument ? user._id : user;
  const version = isDocument ? user.tokenVersion || 0 : 0;

  return jwt.sign({ id: String(id), v: version }, config.jwt.secret, {
    algorithm: "HS256",
    expiresIn: config.jwt.expiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
}

/**
 * A token stays valid only while its version matches the account's. Tokens
 * signed before versions existed have no "v" and count as generation 0.
 */
function isCurrentToken(payload, user) {
  const signed = Number((payload && payload.v) || 0);
  const current = Number((user && user.tokenVersion) || 0);
  return signed === current;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * Production cookies are Secure. SameSite is "none" only when the frontend and
 * API genuinely sit on different hosts, otherwise "lax".
 * COOKIE_SAMESITE overrides the guess.
 */
function resolveSameSite() {
  if (process.env.COOKIE_SAMESITE) return process.env.COOKIE_SAMESITE;
  if (!config.isProd) return "lax";
  const clientHost = safeHost(config.clientUrl);
  const apiHost = safeHost(config.apiUrl);
  return clientHost && apiHost && clientHost !== apiHost ? "none" : "lax";
}

function baseCookieOptions() {
  const sameSite = resolveSameSite();
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite,
    path: "/",
    // SameSite=None requires Secure, and a cross-site cookie needs the "none"
    // attribute to survive the round trip.
    ...(sameSite === "none" ? { secure: true } : {}),
  };
}

/**
 * The cookie lives exactly as long as the token, so a cleared cookie and a
 * dead token always expire together.
 */
function setAuthCookie(res, token) {
  const { exp } = jwt.decode(token) || {};
  const maxAge = exp ? exp * 1000 - Date.now() : 7 * 24 * 60 * 60 * 1000;

  res.cookie(COOKIE_NAME, token, { ...baseCookieOptions(), maxAge });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, baseCookieOptions());
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  isCurrentToken,
  setAuthCookie,
  clearAuthCookie,
  resolveSameSite,
};
