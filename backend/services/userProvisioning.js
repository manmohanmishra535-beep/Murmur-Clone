"use strict";

const { randomBytes } = require("crypto");
const User = require("../models/User");
const { clerkClient } = require("@clerk/express");

const USERNAME_MIN = 3;
const USERNAME_MAX = 15;

/**
 * The handle has to satisfy the same rule the old register form enforced:
 * 3 to 15 lowercase letters, numbers or underscores. Clerk usernames are far
 * more permissive, so anything else is folded into that shape.
 */
function sanitizeUsername(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, USERNAME_MAX);
}

/**
 * Clerk username first (when the instance collects one), then the email's
 * local part, then the tail of the Clerk id. The result is only a starting
 * point; availableUsername() makes sure it is free.
 */
function usernameBase({ username, email, sub } = {}) {
  const fromUsername = sanitizeUsername(username);
  if (fromUsername.length >= USERNAME_MIN) return fromUsername;

  const fromEmail = sanitizeUsername(String(email || "").split("@")[0]);
  if (fromEmail.length >= USERNAME_MIN) return fromEmail;

  const tail = sanitizeUsername(String(sub || "").replace(/^user_/, "")).slice(-6);
  return `user_${tail || randomBytes(3).toString("hex")}`;
}

/** Append 2, 3, ... until the handle is free, then fall back to a random one. */
async function availableUsername(base) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const candidate = `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `user_${randomBytes(3).toString("hex")}`;
}

/**
 * A session token can carry the profile as custom claims (a Clerk JWT template
 * with email/username/name/image_url). Without those claims the profile is
 * fetched from Clerk once, on the request that creates the row.
 */
async function profileFor(clerkId, claims = {}) {
  if (claims.email) {
    return {
      email: String(claims.email).toLowerCase(),
      username: claims.username,
      name: claims.name,
      imageUrl: claims.image_url,
    };
  }

  const person = await clerkClient.users.getUser(clerkId);
  const addresses = Array.isArray(person.emailAddresses) ? person.emailAddresses : [];
  const primary =
    addresses.find((entry) => entry.id === person.primaryEmailAddressId) || addresses[0];

  return {
    email: primary && primary.emailAddress ? String(primary.emailAddress).toLowerCase() : "",
    username: person.username,
    name: [person.firstName, person.lastName].filter(Boolean).join(" "),
    imageUrl: person.imageUrl,
  };
}

/**
 * Resolve the Clerk session to an app profile, creating it the first time.
 *
 * Called on every authenticated request, so the common path is one indexed
 * lookup. A row created before Clerk was introduced is adopted by the email
 * Clerk has already verified, which keeps that person's posts and followers.
 */
async function ensureUser({ userId, sessionClaims } = {}) {
  if (!userId) return null;

  const existing = await User.findOne({ clerkId: userId });
  if (existing) return existing;

  const claims = sessionClaims || {};
  const profile = await profileFor(userId, claims);
  const email = profile.email || `${userId}@clerk.invalid`;

  const adopted = await User.findOneAndUpdate(
    { email, clerkId: { $exists: false } },
    { $set: { clerkId: userId } },
    { new: true }
  );
  if (adopted) return adopted;

  const username = await availableUsername(
    usernameBase({ username: profile.username, email: profile.email, sub: userId })
  );

  const draft = {
    clerkId: userId,
    email,
    username,
    displayName: String(profile.name || username).slice(0, 50),
    profileImage: profile.imageUrl ? { url: profile.imageUrl } : {},
  };

  try {
    return await User.create(draft);
  } catch (error) {
    // Two first requests can arrive together; the other one created the row.
    if (error && error.code === 11000) {
      const raced = await User.findOne({ clerkId: userId });
      if (raced) return raced;
      // The handle was taken in the meantime, not the Clerk id.
      return User.create({ ...draft, username: `user_${randomBytes(3).toString("hex")}` });
    }
    throw error;
  }
}

module.exports = {
  ensureUser,
  sanitizeUsername,
  usernameBase,
  availableUsername,
};
