"use strict";

const { verifyToken, COOKIE_NAME } = require("../utils/token");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Reads the httpOnly token cookie, verifies it and attaches req.user.
 * Any failure is a 401 with the same shape so the client can treat them alike.
 */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token) throw AppError.unauthenticated();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw AppError.unauthenticated("Your session expired. Log in again.");
  }

  const user = await User.findById(payload.id);
  if (!user) throw AppError.unauthenticated("Your session expired. Log in again.");

  req.user = user;
  next();
});

/** Populate req.user when a cookie is present, but let anonymous traffic through. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    req.user = await User.findById(payload.id);
  } catch {
    req.user = undefined;
  }
  return next();
});

/** Ownership check for edit and delete routes: 403 when it is someone else's document. */
function assertOwner(document, userId, resource = "resource") {
  if (!document) throw AppError.notFound();
  const author = document.author && document.author._id ? document.author._id : document.author;
  if (String(author) !== String(userId)) {
    throw AppError.forbidden(`You can only change your own ${resource}.`);
  }
  return document;
}

module.exports = { requireAuth, optionalAuth, assertOwner };
