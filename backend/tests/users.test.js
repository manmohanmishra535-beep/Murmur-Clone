"use strict";

const { agent, anonymous, registerUser } = require("./helpers");

describe("GET /api/users/:username", () => {
  it("returns a public profile without a session", async () => {
    await registerUser();

    const res = await anonymous().get("/api/users/priya");

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("priya");
    expect(res.body.user.isFollowing).toBe(false);
    expect(res.body.user).not.toHaveProperty("email");
  });

  it("returns a public profile without the email", async () => {
    const { client } = await registerUser();

    const res = await client.get("/api/users/priya");

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("priya");
    expect(res.body.user.displayName).toBe("priya");
    expect(res.body.user.isFollowing).toBe(false);
    expect(res.body.user.postCount).toBe(0);
    // Followers and followings leave as counts, never as id arrays.
    expect(res.body.user).not.toHaveProperty("followers");
    expect(res.body.user).not.toHaveProperty("following");
    expect(res.body.user).not.toHaveProperty("bookmarks");
  });

  it("includes the email when the viewer is the owner", async () => {
    const { client } = await registerUser();

    const res = await client.get("/api/users/priya");

    expect(res.body.user.email).toBe("priya@example.com");
  });

  it("returns 404 for an unknown username", async () => {
    const { client } = await registerUser();

    const res = await client.get("/api/users/nobody_here");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/users/me", () => {
  it("returns 401 unauthenticated", async () => {
    const res = await anonymous().patch("/api/users/me").field("bio", "hello");

    expect(res.status).toBe(401);
  });

  it("updates displayName and bio", async () => {
    const { client } = await registerUser();

    const res = await client
      .patch("/api/users/me")
      .field("displayName", "Priya Nair")
      .field("bio", "Trains, chai and 280 characters.");

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("Priya Nair");
    expect(res.body.user.bio).toBe("Trains, chai and 280 characters.");
  });

  it("returns 422 when the bio is longer than 160 characters", async () => {
    const { client } = await registerUser();

    const res = await client.patch("/api/users/me").field("bio", "x".repeat(161));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.bio).toBeDefined();
  });

  it("returns 422 when the display name is longer than 50 characters", async () => {
    const { client } = await registerUser();

    const res = await client.patch("/api/users/me").field("displayName", "n".repeat(51));

    expect(res.status).toBe(422);
    expect(res.body.error.fields.displayName).toBeDefined();
  });

  it("rejects a non-image attachment", async () => {
    const { client } = await registerUser();

    const res = await client
      .patch("/api/users/me")
      .attach("image", Buffer.from("not an image"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.image).toBeDefined();
  });

  it("leaves the profile untouched when no fields are sent", async () => {
    const { client } = await registerUser();

    const res = await client.patch("/api/users/me").field("note", "ignored");

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("priya");
  });
});
