"use strict";

const asyncHandler = require("../utils/asyncHandler");
const { serializeUser } = require("../utils/serialize");

/**
 * GET /api/auth/me - the app profile behind the Clerk session.
 *
 * The first call after sign-up creates the profile (see userProvisioning), so
 * the client can treat this endpoint as "who am I, and make sure I exist".
 * Sign-up, sign-in, sign-out and password resets are Clerk's job and have no
 * route here.
 */
const me = asyncHandler(async (req, res) => {
  res.status(200).json({ user: serializeUser(req.user, { includeEmail: true }) });
});

module.exports = { me };
