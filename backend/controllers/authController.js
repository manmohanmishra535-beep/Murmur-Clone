"use strict";

const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken, setAuthCookie, clearAuthCookie } = require("../utils/token");
const { serializeUser } = require("../utils/serialize");

/** Register -> 201 with the new user and a session cookie. */
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // The unique indexes are the real guard; this query just returns a nicer 409
  // for the common case before Mongo raises a duplicate key error.
  const existing = await User.findOne({ $or: [{ username }, { email }] }).select(
    "username email"
  );
  if (existing) {
    const field = existing.username === username ? "username" : "email";
    const message = `That ${field} is already taken.`;
    throw new AppError(409, "ALREADY_EXISTS", message, { [field]: message });
  }

  const user = await User.create({
    username,
    email,
    password,
    // A display name is optional; fall back to the handle until it is set.
    displayName: req.body.displayName ? String(req.body.displayName).trim() : username,
  });

  setAuthCookie(res, signToken(user._id));

  res.status(201).json({ user: serializeUser(user, { includeEmail: true }) });
});

/** Login -> 200 with the user and a fresh session cookie. */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");

  // One message for both a missing account and a wrong password, so the
  // endpoint cannot be used to enumerate emails.
  const invalid = new AppError(
    401,
    "INVALID_CREDENTIALS",
    "Email or password is incorrect."
  );
  if (!user) throw invalid;

  const matches = await user.comparePassword(password);
  if (!matches) throw invalid;

  setAuthCookie(res, signToken(user._id));

  res.status(200).json({ user: serializeUser(user, { includeEmail: true }) });
});

/** Logout -> 204 and the cookie is gone. */
const logout = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

/** Current user, used on first load to hydrate the client. */
const me = asyncHandler(async (req, res) => {
  res.status(200).json({ user: serializeUser(req.user, { includeEmail: true }) });
});

module.exports = { register, login, logout, me };
