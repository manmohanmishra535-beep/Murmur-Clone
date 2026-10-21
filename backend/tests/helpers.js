"use strict";

const crypto = require("crypto");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { serializeUser } = require("../utils/serialize");

const VALID_USER = {
  username: "priya",
  email: "priya@example.com",
};

/** A minimal RS256 JWT, so the suite needs no signing library. */
function signJwt(payload, privateKey = process.env.TEST_CLERK_PRIVATE_KEY) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url"
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey);

  return `${header}.${body}.${signature.toString("base64url")}`;
}

/**
 * A Clerk-shaped session token. The extra claims (email, username, name,
 * image_url) are what a JWT template adds in production; without them the API
 * would ask Clerk's Backend API for the profile.
 */
function clerkToken(clerkId, claims = {}) {
  const now = Math.floor(Date.now() / 1000);

  return signJwt({
    sub: clerkId,
    sid: `sess_${clerkId}`,
    azp: "http://localhost:3000",
    iat: now,
    nbf: now,
    exp: now + 60 * 60,
    ...claims,
  });
}

/** A client that sends the Clerk token the way the browser does. */
function agent(token) {
  const call = (method) => (url) => {
    const test = request(app)[method](url);
    return token ? test.set("Authorization", `Bearer ${token}`) : test;
  };

  return {
    get: call("get"),
    post: call("post"),
    patch: call("patch"),
    put: call("put"),
    delete: call("delete"),
  };
}

function anonymous() {
  return request(app);
}

/**
 * Create the app profile and the Clerk token that belongs to it. Tests that are
 * not about provisioning start here, exactly as a signed-in browser would after
 * its first /auth/me call.
 */
async function registerUser(overrides = {}) {
  const payload = { ...VALID_USER, ...overrides };
  const clerkId = `user_${crypto.randomUUID().replace(/-/g, "")}`;

  const user = await User.create({
    clerkId,
    username: payload.username,
    email: payload.email,
    displayName: payload.displayName || payload.username,
  });

  const token = clerkToken(clerkId, {
    email: payload.email,
    username: payload.username,
    name: payload.displayName || payload.username,
  });

  return {
    client: agent(token),
    // Same shape the API returns, so tests can compare ids as strings.
    user: serializeUser(user, { includeEmail: true }),
    token,
    clerkId,
    payload,
  };
}

module.exports = {
  app,
  agent,
  anonymous,
  registerUser,
  clerkToken,
  signJwt,
  VALID_USER,
};
