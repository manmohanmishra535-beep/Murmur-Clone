"use strict";

const crypto = require("crypto");
const User = require("../models/User");
const { agent, anonymous, registerUser, clerkToken, signJwt } = require("./helpers");

describe("GET /api/auth/me", () => {
  it("returns 401 without a token", async () => {
    const res = await anonymous().get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for something that is not a token", async () => {
    const res = await anonymous()
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.real.token");

    expect(res.status).toBe(401);
  });

  it("returns 401 for a token signed with another key", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const forged = signJwt(
      {
        sub: "user_forged",
        sid: "sess_forged",
        azp: "http://localhost:3000",
        iat: now,
        nbf: now,
        exp: now + 3600,
      },
      privateKey
    );

    const res = await anonymous().get("/api/auth/me").set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = clerkToken("user_expired", {
      email: "expired@example.com",
      iat: now - 120,
      nbf: now - 120,
      exp: now - 60,
    });

    const res = await agent(token).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(await User.countDocuments({ clerkId: "user_expired" })).toBe(0);
  });

  it("returns 401 for a token issued for another origin", async () => {
    const token = clerkToken("user_elsewhere", {
      email: "elsewhere@example.com",
      azp: "https://evil.example.com",
    });

    const res = await agent(token).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  it("creates the app profile on first use", async () => {
    const token = clerkToken("user_new", {
      email: "new@example.com",
      username: "newbie",
      name: "New Bie",
      image_url: "https://img.clerk.com/new.png",
    });

    const res = await agent(token).get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      username: "newbie",
      displayName: "New Bie",
      email: "new@example.com",
      profileImage: { url: "https://img.clerk.com/new.png" },
      followerCount: 0,
      followingCount: 0,
    });
    // Clerk's id stays on the server; the app's own id is what the client uses.
    expect(res.body.user.clerkId).toBeUndefined();

    const stored = await User.findOne({ clerkId: "user_new" });
    expect(stored).toBeTruthy();
    expect(stored.username).toBe("newbie");
  });

  it("returns the same profile on every later call", async () => {
    const token = clerkToken("user_same", {
      email: "same@example.com",
      username: "same",
    });

    const first = await agent(token).get("/api/auth/me");
    const second = await agent(token).get("/api/auth/me");

    expect(second.status).toBe(200);
    expect(second.body.user._id).toBe(first.body.user._id);
    expect(await User.countDocuments({ clerkId: "user_same" })).toBe(1);
  });

  it("falls back to the email's local part when Clerk has no username", async () => {
    const token = clerkToken("user_nouser", { email: "quiet.person@example.com" });

    const res = await agent(token).get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("quiet_person");
    expect(res.body.user.displayName).toBe("quiet_person");
  });

  it("adds a suffix when the preferred handle is taken", async () => {
    await User.create({ username: "priya", email: "taken@example.com" });

    const token = clerkToken("user_dup", {
      email: "dup@example.com",
      username: "priya",
    });
    const res = await agent(token).get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("priya2");
  });

  it("adopts a profile created before Clerk, by verified email", async () => {
    const legacy = await User.create({
      username: "olduser",
      email: "legacy@example.com",
      bio: "Here first.",
    });

    const token = clerkToken("user_legacy", {
      email: "legacy@example.com",
      username: "legacy",
    });
    const res = await agent(token).get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(String(legacy._id));
    expect(res.body.user.bio).toBe("Here first.");

    const stored = await User.findById(legacy._id);
    expect(stored.clerkId).toBe("user_legacy");
    // The old handle is kept: it may already be in links and mentions.
    expect(stored.username).toBe("olduser");
  });

  it("treats a bad token as anonymous on a public read", async () => {
    const { user } = await registerUser();

    const res = await anonymous()
      .get(`/api/users/${user.username}`)
      .set("Authorization", "Bearer nonsense");

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("priya");
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
