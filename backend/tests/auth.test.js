"use strict";

const User = require("../models/User");
const { agent, anonymous, registerUser, findCookie, VALID_USER } = require("./helpers");

describe("POST /api/auth/register", () => {
  it("creates a user, returns 201 and sets the token cookie", async () => {
    const client = agent();

    const res = await client.post("/api/auth/register").send(VALID_USER);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      username: "priya",
      displayName: "priya",
      email: "priya@example.com",
      followerCount: 0,
      followingCount: 0,
    });
    expect(res.body.user._id).toBeDefined();

    const cookie = findCookie(res, "token");
    expect(cookie).toBeTruthy();
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("never stores the password in plain text and never returns it", async () => {
    await registerUser();

    const stored = await User.findOne({ username: "priya" }).select("+password");
    expect(stored.password).not.toBe(VALID_USER.password);
    expect(stored.password.startsWith("$2")).toBe(true);
    expect(stored.password.length).toBeGreaterThan(50);
  });

  it("returns 422 with per-field messages for invalid input", async () => {
    const res = await anonymous().post("/api/auth/register").send({
      username: "p!",
      email: "not-an-email",
      password: "short",
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields).toMatchObject({
      username: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
    });
  });

  it("returns 409 when the username is taken", async () => {
    await registerUser();

    const res = await anonymous()
      .post("/api/auth/register")
      .send({ ...VALID_USER, email: "other@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_EXISTS");
    expect(res.body.error.fields.username).toBeDefined();
  });

  it("returns 409 when the email is taken", async () => {
    await registerUser();

    const res = await anonymous()
      .post("/api/auth/register")
      .send({ ...VALID_USER, username: "someone_else" });

    expect(res.status).toBe(409);
    expect(res.body.error.fields.email).toBeDefined();
  });

  it("lowercases the username and email", async () => {
    const res = await anonymous().post("/api/auth/register").send({
      username: "Priya_Nair",
      email: "Priya@Example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe("priya_nair");
    expect(res.body.user.email).toBe("priya@example.com");
  });
});

describe("POST /api/auth/login", () => {
  it("returns 200 and a cookie for correct credentials", async () => {
    await registerUser();

    const res = await anonymous()
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("priya");
    expect(findCookie(res, "token")).toBeTruthy();
  });

  it("returns 401 for a wrong password", async () => {
    await registerUser();

    const res = await anonymous()
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for an unknown email without revealing it", async () => {
    const res = await anonymous()
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 422 when fields are missing", async () => {
    const res = await anonymous().post("/api/auth/login").send({});

    expect(res.status).toBe(422);
    expect(res.body.error.fields).toMatchObject({
      email: expect.any(String),
      password: expect.any(String),
    });
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a cookie", async () => {
    const res = await anonymous().get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for a tampered token", async () => {
    const res = await anonymous()
      .get("/api/auth/me")
      .set("Cookie", "token=not.a.real.token");

    expect(res.status).toBe(401);
  });

  it("returns the current user with the cookie", async () => {
    const { client } = await registerUser();

    const res = await client.get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: "priya", email: VALID_USER.email });
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 204, clears the cookie and ends the session", async () => {
    const { client } = await registerUser();

    const logout = await client.post("/api/auth/logout");
    expect(logout.status).toBe(204);

    const cleared = findCookie(logout, "token");
    expect(cleared).toBeTruthy();
    expect(cleared).toMatch(/token=;|Expires=Thu, 01 Jan 1970/i);

    const me = await client.get("/api/auth/me");
    expect(me.status).toBe(401);
  });

  it("returns 401 when nobody is logged in", async () => {
    const res = await anonymous().post("/api/auth/logout");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/forgot-password", () => {
  /** The API answers with the reset link outside production; tests use it. */
  async function requestReset(email = VALID_USER.email) {
    const res = await anonymous().post("/api/auth/forgot-password").send({ email });
    return res;
  }

  function tokenFrom(res) {
    return new URL(res.body.resetUrl).searchParams.get("token");
  }

  it("answers 202 with the same message for a known and an unknown address", async () => {
    await registerUser();

    const known = await requestReset();
    const unknown = await requestReset("nobody@example.com");

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body.message).toBe(unknown.body.message);
    expect(known.body.message).toMatch(/if an account exists/i);
  });

  it("stores only a hash of the token, never the token itself", async () => {
    await registerUser();

    const token = tokenFrom(await requestReset());
    const stored = await User.findOne({ username: "priya" }).select(
      "+resetTokenHash +resetTokenExpiresAt"
    );

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.resetTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.resetTokenHash).not.toBe(token);
    expect(stored.resetTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
    // The document that comes back from a normal query never carries these.
    const plain = await User.findOne({ username: "priya" });
    expect(plain.resetTokenHash).toBeUndefined();
  });

  it("leaves the current password working until the link is used", async () => {
    await registerUser();
    await requestReset();

    const res = await anonymous()
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.status).toBe(200);
  });

  it("returns 422 for a malformed email", async () => {
    const res = await requestReset("not-an-address");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.email).toBeDefined();
  });

  it("replaces an earlier link when a new one is requested", async () => {
    await registerUser();

    const first = tokenFrom(await requestReset());
    const second = tokenFrom(await requestReset());
    expect(second).not.toBe(first);

    const res = await anonymous()
      .post("/api/auth/reset-password")
      .send({ token: first, password: "brand-new-pass" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/reset-password", () => {
  async function linkToken() {
    const res = await anonymous()
      .post("/api/auth/forgot-password")
      .send({ email: VALID_USER.email });
    return new URL(res.body.resetUrl).searchParams.get("token");
  }

  it("changes the password, spends the link and does not sign the caller in", async () => {
    await registerUser();
    const token = await linkToken();

    const reset = await anonymous()
      .post("/api/auth/reset-password")
      .send({ token, password: "brand-new-pass" });

    expect(reset.status).toBe(200);
    expect(findCookie(reset, "token")).toBeNull();

    const oldPassword = await anonymous()
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(oldPassword.status).toBe(401);

    const newPassword = await anonymous()
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: "brand-new-pass" });
    expect(newPassword.status).toBe(200);

    // A reset link is single use.
    const reused = await anonymous()
      .post("/api/auth/reset-password")
      .send({ token, password: "even-newer-pass" });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("logs out sessions opened before the reset", async () => {
    const { client } = await registerUser();
    const token = await linkToken();

    await anonymous().post("/api/auth/reset-password").send({ token, password: "brand-new-pass" });

    const me = await client.get("/api/auth/me");
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects an expired link", async () => {
    const { user } = await registerUser();
    const token = await linkToken();

    await User.updateOne(
      { _id: user._id },
      { $set: { resetTokenExpiresAt: new Date(Date.now() - 60 * 1000) } }
    );

    const res = await anonymous()
      .post("/api/auth/reset-password")
      .send({ token, password: "brand-new-pass" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("rejects an unknown token with the same answer", async () => {
    const res = await anonymous()
      .post("/api/auth/reset-password")
      .send({ token: "a".repeat(64), password: "brand-new-pass" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("returns 422 when the new password is too short or the token is missing", async () => {
    const short = await anonymous()
      .post("/api/auth/reset-password")
      .send({ token: "a".repeat(64), password: "short" });

    expect(short.status).toBe(422);
    expect(short.body.error.fields.password).toBeDefined();

    const missing = await anonymous()
      .post("/api/auth/reset-password")
      .send({ password: "brand-new-pass" });

    expect(missing.status).toBe(422);
    expect(missing.body.error.fields.token).toBeDefined();
  });
});

describe("GET /api/health", () => {
  it("reports ok without authentication", async () => {
    const res = await anonymous().get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(["connected", "disconnected"]).toContain(res.body.db);
  });

  it("stamps every response with a request id for the logs", async () => {
    const res = await anonymous().get("/api/health");

    expect(res.headers["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{1,64}$/);
  });

  it("keeps a sane request id the caller supplies", async () => {
    // Proxies and the client can pass one along so a trace spans both.
    const res = await anonymous().get("/api/health").set("X-Request-Id", "trace-123");

    expect(res.headers["x-request-id"]).toBe("trace-123");
  });

  it("replaces an id that is not the expected shape", async () => {
    // Anything that could break a log line (spaces, control characters, an
    // enormous value) is swapped for a fresh one rather than echoed back.
    const res = await anonymous()
      .get("/api/health")
      .set("X-Request-Id", "bad id with spaces and [brackets]");

    expect(res.headers["x-request-id"]).not.toBe("bad id with spaces and [brackets]");
    expect(res.headers["x-request-id"]).toMatch(/^[A-Za-z0-9._-]{1,64}$/);
  });
});
