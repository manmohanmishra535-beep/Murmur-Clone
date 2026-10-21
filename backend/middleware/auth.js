"use strict";

const { getAuth } = require("@clerk/express");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { ensureUser } = require("../services/userProvisioning");

/**
 * Clerk's middleware verified the bearer token (or the __session cookie) and
 * left the result on the request. This turns a Clerk user id into the app's
 * profile, creating the profile on first use.
 */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) throw AppError.unauthenticated("Sign in to continue.");

  req.auth = auth;
  req.user = await ensureUser(auth);
  next();
});

/** Populate req.user when a token is present, but let anonymous traffic through. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) return next();

  try {
    req.auth = auth;
    req.user = await ensureUser(auth);
  } catch {
    // A public read must not fail because a profile could not be provisioned.
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
