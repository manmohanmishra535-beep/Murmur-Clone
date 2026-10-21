"use strict";

const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const config = require("../config/env");
const { signToken, setAuthCookie, clearAuthCookie } = require("../utils/token");
const { createResetToken, hashResetToken } = require("../utils/resetToken");
const { sendPasswordResetEmail } = require("../utils/mailer");
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

  setAuthCookie(res, signToken(user));

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

  setAuthCookie(res, signToken(user));

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

/**
 * Forgot password -> 202 with one message, whatever the address is.
 * The answer never says whether the account exists, so the endpoint cannot be
 * used to enumerate emails. A hash of the emailed token is stored for 30
 * minutes; the token itself only exists in the link.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const message =
    "If an account exists for that address, a reset link is on its way.";

  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    res.status(202).json({ message });
    return;
  }

  const { token, hash, expiresAt } = createResetToken();
  user.resetTokenHash = hash;
  user.resetTokenExpiresAt = expiresAt;
  await user.save();

  const resetUrl = `${config.clientUrl}/reset-password?token=${token}`;
  await sendPasswordResetEmail({ to: user.email, username: user.username, url: resetUrl });

  // Development convenience only: the frontend offers the link directly when
  // no mail server is set up. Production never gets it.
  res.status(202).json(config.exposeResetUrl ? { message, resetUrl } : { message });
});

/**
 * Reset password -> 200. The lookup compares the hash and the expiry in one
 * query, so an unknown, used or expired token all produce the same 400.
 * Saving also bumps tokenVersion, which logs out sessions opened with the old
 * password.
 */
const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetTokenHash: hashResetToken(req.body.token),
    resetTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError(
      400,
      "INVALID_RESET_TOKEN",
      "That reset link is invalid or has expired. Request a new one."
    );
  }

  user.password = req.body.password;
  // One use only: the token is spent even if the save below fails halfway.
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();

  res.status(200).json({ message: "Your password has been changed. Log in with it." });
});

module.exports = { register, login, logout, me, forgotPassword, resetPassword };
