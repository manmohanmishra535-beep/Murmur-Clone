"use strict";

const jwt = require("jsonwebtoken");
const config = require("../config/env");

const COOKIE_NAME = "token";

/** HS256 token whose payload is just the user id. */
function signToken(userId) {
  return jwt.sign({ id: String(userId) }, config.jwt.secret, {
    algorithm: "HS256",
    expiresIn: config.jwt.expiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
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
  setAuthCookie,
  clearAuthCookie,
  resolveSameSite,
};
