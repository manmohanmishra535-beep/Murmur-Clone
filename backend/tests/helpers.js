"use strict";

const request = require("supertest");
const app = require("../app");

const VALID_USER = {
  username: "priya",
  email: "priya@example.com",
  password: "password123",
};

/** A supertest agent remembers the httpOnly token cookie between requests. */
function agent() {
  return request.agent(app);
}

function anonymous() {
  return request(app);
}

/** Register and return the authenticated agent plus the created user. */
async function registerUser(overrides = {}) {
  const client = agent();
  const payload = { ...VALID_USER, ...overrides };
  const res = await client.post("/api/auth/register").send(payload);
  return { client, res, user: res.body && res.body.user, payload };
}

/** Pull one cookie out of a Set-Cookie header list. */
function findCookie(res, name) {
  const header = res.headers["set-cookie"] || [];
  return header.find((entry) => entry.startsWith(`${name}=`)) || null;
}

module.exports = { app, agent, anonymous, registerUser, findCookie, VALID_USER };
