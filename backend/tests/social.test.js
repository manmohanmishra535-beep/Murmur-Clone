"use strict";

const Comment = require("../models/Comment");
const Post = require("../models/Post");
const User = require("../models/User");
const { agent, anonymous, registerUser } = require("./helpers");

const SECOND = { username: "arjun", email: "arjun@example.com", password: "password123" };
const THIRD = { username: "meera", email: "meera@example.com", password: "password123" };

/** Create a text post and return the serialized body. */
async function post(client, content) {
  const res = await client.post("/api/posts").field("content", content);
  expect(res.status).toBe(201);
  return res.body;
}

/** Register a second account and return it, so tests read as conversations. */
async function otherUser(overrides = SECOND) {
  const { client, user } = await registerUser(overrides);
  return { client, user };
}

describe("POST /api/posts/:id/like", () => {
  it("requires a session", async () => {
    const res = await anonymous().post(`/api/posts/${"a".repeat(24)}/like`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("likes a post and returns the documented shape", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Trains were on time.");

    const res = await client.post(`/api/posts/${created._id}/like`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: true, likeCount: 1 });
  });

  it("moves the counter with the list and never leaks the list", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Quiet carriage.");

    await client.post(`/api/posts/${created._id}/like`);

    const stored = await Post.findById(created._id).lean();
    expect(stored.likes).toHaveLength(1);
    expect(stored.likeCount).toBe(1);

    const read = await client.get(`/api/posts/${created._id}`);
    expect(read.body.likedByMe).toBe(true);
    expect(read.body.likeCount).toBe(1);
    expect(read.body.likes).toBeUndefined();
  });

  it("is idempotent: a double tap cannot like twice", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Double tap.");

    await client.post(`/api/posts/${created._id}/like`);
    const second = await client.post(`/api/posts/${created._id}/like`);

    expect(second.body).toEqual({ liked: true, likeCount: 1 });
    const stored = await Post.findById(created._id).lean();
    expect(stored.likes).toHaveLength(1);
  });

  it("counts likes from several accounts", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Popular.");

    const second = await otherUser();
    const third = await registerUser(THIRD);

    await second.client.post(`/api/posts/${created._id}/like`);
    const res = await third.client.post(`/api/posts/${created._id}/like`);

    expect(res.body.likeCount).toBe(2);
    const read = await third.client.get(`/api/posts/${created._id}`);
    expect(read.body.likedByMe).toBe(true);
  });

  it("404s for a post that does not exist", async () => {
    const { client } = await registerUser();
    const res = await client.post(`/api/posts/${"b".repeat(24)}/like`);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/posts/:id/like", () => {
  it("unlikes a post and returns the documented shape", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Second thoughts.");

    await client.post(`/api/posts/${created._id}/like`);
    const res = await client.delete(`/api/posts/${created._id}/like`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: false, likeCount: 0 });
  });

  it("is idempotent and never drives the counter below zero", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Nothing to undo.");

    const res = await client.delete(`/api/posts/${created._id}/like`);

    expect(res.body).toEqual({ liked: false, likeCount: 0 });
    const stored = await Post.findById(created._id).lean();
    expect(stored.likeCount).toBe(0);
  });

  it("leaves other people's likes alone", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Two readers.");

    const second = await otherUser();
    await client.post(`/api/posts/${created._id}/like`);
    await second.client.post(`/api/posts/${created._id}/like`);

    const res = await client.delete(`/api/posts/${created._id}/like`);

    expect(res.body.likeCount).toBe(1);
  });
});

describe("POST /api/posts/:id/comments", () => {
  it("requires a session", async () => {
    const res = await anonymous()
      .post(`/api/posts/${"c".repeat(24)}/comments`)
      .send({ content: "hello" });
    expect(res.status).toBe(401);
  });

  it("creates a reply and echoes the documented shape", async () => {
    const { client, user } = await registerUser();
    const created = await post(client, "Which platform?");

    const res = await client
      .post(`/api/posts/${created._id}/comments`)
      .send({ content: "  Platform two, every time.  " });

    expect(res.status).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.post).toBe(created._id);
    expect(res.body.content).toBe("Platform two, every time.");
    expect(res.body.author.username).toBe(user.username);
    expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
  });

  it("bumps commentCount in the same request", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Counted.");

    await client.post(`/api/posts/${created._id}/comments`).send({ content: "one" });
    await client.post(`/api/posts/${created._id}/comments`).send({ content: "two" });

    const read = await client.get(`/api/posts/${created._id}`);
    expect(read.body.commentCount).toBe(2);
  });

  it("rejects an empty or whitespace-only reply", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Empty reply.");

    const res = await client
      .post(`/api/posts/${created._id}/comments`)
      .send({ content: "   " });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(await Comment.countDocuments()).toBe(0);
  });

  it("rejects a reply over 280 characters", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Too long.");

    const res = await client
      .post(`/api/posts/${created._id}/comments`)
      .send({ content: "x".repeat(281) });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.content).toBe("Keep your reply to 280 characters.");
  });

  it("404s when the post does not exist", async () => {
    const { client } = await registerUser();
    const res = await client
      .post(`/api/posts/${"d".repeat(24)}/comments`)
      .send({ content: "into the void" });

    expect(res.status).toBe(404);
    expect(await Comment.countDocuments()).toBe(0);
  });
});

describe("GET /api/posts/:id/comments", () => {
  it("lists replies newest first", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Read the thread.");

    await client.post(`/api/posts/${created._id}/comments`).send({ content: "first" });
    await client.post(`/api/posts/${created._id}/comments`).send({ content: "second" });

    const res = await client.get(`/api/posts/${created._id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.items.map((item) => item.content)).toEqual(["second", "first"]);
    expect(res.body.nextCursor).toBeNull();
  });

  it("is readable without a session, like the post itself", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Shared link.");
    await client.post(`/api/posts/${created._id}/comments`).send({ content: "public" });

    const res = await anonymous().get(`/api/posts/${created._id}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("paginates with a cursor and a clamped limit", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Long thread.");

    for (let index = 0; index < 3; index += 1) {
      await client.post(`/api/posts/${created._id}/comments`).send({ content: `reply ${index}` });
    }

    const first = await client.get(`/api/posts/${created._id}/comments?limit=2`);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBe(first.body.items[1]._id);

    const second = await client.get(
      `/api/posts/${created._id}/comments?limit=2&cursor=${first.body.nextCursor}`
    );
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });

  it("404s for a post that does not exist", async () => {
    const { client } = await registerUser();
    const res = await client.get(`/api/posts/${"e".repeat(24)}/comments`);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/comments/:id", () => {
  it("lets the author delete their own reply and moves the counter", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Removable.");
    const reply = await client.post(`/api/posts/${created._id}/comments`).send({ content: "bye" });

    const res = await client.delete(`/api/comments/${reply.body._id}`);

    expect(res.status).toBe(204);
    expect(await Comment.countDocuments()).toBe(0);
    const read = await client.get(`/api/posts/${created._id}`);
    expect(read.body.commentCount).toBe(0);
  });

  it("refuses a reply written by someone else", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Not yours.");
    const reply = await client.post(`/api/posts/${created._id}/comments`).send({ content: "mine" });

    const second = await otherUser();
    const res = await second.client.delete(`/api/comments/${reply.body._id}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(await Comment.countDocuments()).toBe(1);
  });

  it("requires a session", async () => {
    const res = await anonymous().delete(`/api/comments/${"f".repeat(24)}`);
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/posts/:id with comments", () => {
  it("removes the post's replies with the post", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Going away.");
    await client.post(`/api/posts/${created._id}/comments`).send({ content: "orphan risk" });

    const res = await client.delete(`/api/posts/${created._id}`);

    expect(res.status).toBe(204);
    expect(await Comment.countDocuments()).toBe(0);
    expect(await Post.countDocuments()).toBe(0);
  });
});

describe("POST /api/users/:id/follow", () => {
  it("requires a session", async () => {
    const res = await anonymous().post(`/api/users/${"a".repeat(24)}/follow`);
    expect(res.status).toBe(401);
  });

  it("follows an account and writes both sides of the relationship", async () => {
    const { client } = await registerUser();
    const second = await otherUser();

    const res = await client.post(`/api/users/${second.user._id}/follow`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ following: true });

    const followed = await User.findById(second.user._id).lean();
    const follower = await User.findById((await client.get("/api/auth/me")).body.user._id).lean();
    expect(followed.followers.map(String)).toContain(String(follower._id));
    expect(follower.following.map(String)).toContain(String(followed._id));
  });

  it("shows up as isFollowing on the profile", async () => {
    const { client } = await registerUser();
    const second = await otherUser();

    const before = await client.get(`/api/users/${second.user.username}`);
    expect(before.body.user.isFollowing).toBe(false);

    await client.post(`/api/users/${second.user._id}/follow`);

    const after = await client.get(`/api/users/${second.user.username}`);
    expect(after.body.user.isFollowing).toBe(true);
    expect(after.body.user.followerCount).toBe(1);
  });

  it("is idempotent: following twice cannot double-count", async () => {
    const { client } = await registerUser();
    const second = await otherUser();

    await client.post(`/api/users/${second.user._id}/follow`);
    const res = await client.post(`/api/users/${second.user._id}/follow`);

    expect(res.body).toEqual({ following: true });
    const followed = await User.findById(second.user._id).lean();
    expect(followed.followers).toHaveLength(1);
  });

  it("refuses a self-follow", async () => {
    const { client, user } = await registerUser();

    const res = await client.post(`/api/users/${user._id}/follow`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("SELF_FOLLOW");
    const stored = await User.findById(user._id).lean();
    expect(stored.following).toHaveLength(0);
  });

  it("404s for an account that does not exist", async () => {
    const { client } = await registerUser();
    const res = await client.post(`/api/users/${"b".repeat(24)}/follow`);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/users/:id/follow", () => {
  it("unfollows and clears both sides", async () => {
    const { client, user } = await registerUser();
    const second = await otherUser();
    await client.post(`/api/users/${second.user._id}/follow`);

    const res = await client.delete(`/api/users/${second.user._id}/follow`);

    expect(res.body).toEqual({ following: false });
    const followed = await User.findById(second.user._id).lean();
    const follower = await User.findById(user._id).lean();
    expect(followed.followers).toHaveLength(0);
    expect(follower.following).toHaveLength(0);
  });

  it("is idempotent when the follow was never there", async () => {
    const { client } = await registerUser();
    const second = await otherUser();

    const res = await client.delete(`/api/users/${second.user._id}/follow`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ following: false });
  });

  it("requires a session", async () => {
    const res = await anonymous().delete(`/api/users/${"c".repeat(24)}/follow`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users/:id/followers and /following", () => {
  it("lists followers with their follow flags and counts", async () => {
    const { client, user } = await registerUser();
    const second = await otherUser();
    await second.client.post(`/api/users/${user._id}/follow`);

    const res = await second.client.get(`/api/users/${user._id}/followers`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].username).toBe(second.user.username);
    expect(res.body.items[0].postCount).toBe(0);
    // The viewer is looking at their own row, so no button would be rendered.
    expect(res.body.items[0].isFollowing).toBe(false);
    expect(res.body.nextCursor).toBeNull();
  });

  it("lists who an account follows, newest first", async () => {
    const { client, user } = await registerUser();
    const second = await otherUser();

    await client.post(`/api/users/${second.user._id}/follow`);
    await client.post(`/api/users/${user._id}/follow`).catch(() => {});

    const res = await client.get(`/api/users/${user._id}/following`);

    expect(res.status).toBe(200);
    expect(res.body.items.map((item) => item.username)).toEqual([second.user.username]);
  });

  it("marks rows the viewer already follows", async () => {
    const { user } = await registerUser();
    const second = await otherUser();
    const third = await registerUser(THIRD);

    // Two accounts follow the profile's owner, and a third looks at the list.
    await second.client.post(`/api/users/${user._id}/follow`);
    await third.client.post(`/api/users/${user._id}/follow`);

    const res = await third.client.get(`/api/users/${user._id}/followers`);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((item) => item.isFollowing === false)).toBe(true);

    await third.client.post(`/api/users/${second.user._id}/follow`);
    const after = await third.client.get(`/api/users/${user._id}/followers`);
    const row = after.body.items.find((item) => item.username === second.user.username);
    expect(row.isFollowing).toBe(true);
  });

  it("is readable without a session", async () => {
    const { client, user } = await registerUser();
    const second = await otherUser();
    await second.client.post(`/api/users/${user._id}/follow`);

    const res = await anonymous().get(`/api/users/${user._id}/followers`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("paginates the members with a cursor", async () => {
    const { client, user } = await registerUser();
    const second = await otherUser();
    const third = await registerUser(THIRD);

    await second.client.post(`/api/users/${user._id}/follow`);
    await third.client.post(`/api/users/${user._id}/follow`);

    const first = await client.get(`/api/users/${user._id}/followers?limit=1`);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).toBe(first.body.items[0]._id);

    const rest = await client.get(
      `/api/users/${user._id}/followers?limit=1&cursor=${first.body.nextCursor}`
    );
    expect(rest.body.items).toHaveLength(1);
    expect(rest.body.nextCursor).toBeNull();
  });

  it("404s for an account that does not exist", async () => {
    const { client } = await registerUser();
    const res = await client.get(`/api/users/${"d".repeat(24)}/followers`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/posts/feed after following", () => {
  it("shows only followed users' posts, and your own, newest first", async () => {
    const { client, user } = await registerUser();
    const second = await otherUser();
    const third = await registerUser(THIRD);

    const mine = await post(client, "My own post.");
    const theirs = await post(second.client, "From someone I follow.");
    await post(third.client, "From a stranger.");

    await client.post(`/api/users/${second.user._id}/follow`);

    const res = await client.get("/api/posts/feed");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item) => item.content)).toEqual([
      theirs.content,
      mine.content,
    ]);
    expect(res.body.items.map((item) => item.author.username)).toEqual([
      second.user.username,
      user.username,
    ]);
  });

  it("stops showing a post once the author is unfollowed", async () => {
    const { client } = await registerUser();
    const second = await otherUser();

    await post(second.client, "Was in my feed.");
    await client.post(`/api/users/${second.user._id}/follow`);
    expect((await client.get("/api/posts/feed")).body.items).toHaveLength(1);

    await client.delete(`/api/users/${second.user._id}/follow`);
    expect((await client.get("/api/posts/feed")).body.items).toHaveLength(0);
  });

  it("fills likedByMe per viewer on the same post", async () => {
    const { client } = await registerUser();
    const second = await otherUser();

    const created = await post(second.client, "One post, two viewers.");
    await client.post(`/api/users/${second.user._id}/follow`);
    await client.post(`/api/posts/${created._id}/like`);

    const mine = await client.get("/api/posts/feed");
    expect(mine.body.items[0].likedByMe).toBe(true);
    expect(mine.body.items[0].likeCount).toBe(1);

    const theirs = await second.client.get("/api/posts/user/" + second.user.username);
    expect(theirs.body.items[0].likedByMe).toBe(false);
    expect(theirs.body.items[0].likeCount).toBe(1);
  });
});

describe("feed isolation", () => {
  it("keeps one account's feed out of another's", async () => {
    const { client } = await registerUser();
    const second = await otherUser();
    const third = await registerUser(THIRD);

    await post(second.client, "Second only.");
    await post(third.client, "Third only.");

    await client.post(`/api/users/${second.user._id}/follow`);

    const mine = await client.get("/api/posts/feed");
    const theirs = await third.client.get("/api/posts/feed");

    expect(mine.body.items.map((item) => item.content)).toEqual(["Second only."]);
    expect(theirs.body.items.map((item) => item.content)).toEqual(["Third only."]);
  });

  it("requires a session", async () => {
    const res = await anonymous().get("/api/posts/feed");
    expect(res.status).toBe(401);
  });
});

describe("follow graph cleanliness", () => {
  it("drops a deleted account from the follower list it belonged to", async () => {
    const { client, user } = await registerUser();
    const second = await otherUser();

    await second.client.post(`/api/users/${user._id}/follow`);
    await User.deleteOne({ _id: second.user._id });

    const res = await client.get(`/api/users/${user._id}/followers`);

    // The stale ObjectId resolves to nothing, so the list comes back empty
    // rather than serving a hole.
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it("does not follow a non-existent id into the graph", async () => {
    const { client, user } = await registerUser();

    const res = await client.post(`/api/users/${"f".repeat(24)}/follow`);

    expect(res.status).toBe(404);
    const stored = await User.findById(user._id).lean();
    expect(stored.following).toHaveLength(0);
  });

  it("counts followers and following on the profile", async () => {
    const { client, user } = await registerUser();
    const second = await otherUser();

    await client.post(`/api/users/${second.user._id}/follow`);

    const mine = await client.get(`/api/users/${user.username}`);
    const theirs = await client.get(`/api/users/${second.user.username}`);

    expect(mine.body.user.followingCount).toBe(1);
    expect(mine.body.user.followerCount).toBe(0);
    expect(theirs.body.user.followerCount).toBe(1);
    expect(theirs.body.user.followingCount).toBe(0);
  });
});

describe("GET /api/posts/explore", () => {
  it("requires a session", async () => {
    const res = await anonymous().get("/api/posts/explore");
    expect(res.status).toBe(401);
  });

  it("shows everyone's posts, newest first, whether or not you follow them", async () => {
    const { client } = await registerUser();
    const second = await otherUser();
    const third = await registerUser(THIRD);

    await post(client, "Mine.");
    await post(second.client, "Theirs.");
    await post(third.client, "A stranger's.");

    const res = await client.get("/api/posts/explore");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item) => item.content)).toEqual([
      "A stranger's.",
      "Theirs.",
      "Mine.",
    ]);
    expect(res.body.nextCursor).toBeNull();
  });

  it("pages with a cursor and a clamped limit", async () => {
    const { client } = await registerUser();
    await post(client, "One.");
    await post(client, "Two.");
    await post(client, "Three.");

    const first = await client.get("/api/posts/explore?limit=2");
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBe(first.body.items[1]._id);

    const rest = await client.get(`/api/posts/explore?limit=2&cursor=${first.body.nextCursor}`);
    expect(rest.body.items).toHaveLength(1);
    expect(rest.body.nextCursor).toBeNull();
  });

  it("fills the viewer's own flags", async () => {
    const { client } = await registerUser();
    const second = await otherUser();

    const created = await post(second.client, "Like this one.");
    await client.post(`/api/posts/${created._id}/like`);

    const res = await client.get("/api/posts/explore");
    const row = res.body.items.find((item) => item._id === created._id);

    expect(row.likedByMe).toBe(true);
    expect(row.likeCount).toBe(1);
    expect(row.likes).toBeUndefined();
  });

  it("rejects a malformed cursor instead of failing", async () => {
    const { client } = await registerUser();
    const res = await client.get("/api/posts/explore?cursor=nope");
    expect(res.status).toBe(422);
  });
});

describe("cursor hygiene", () => {
  it("rejects a malformed cursor with a 422 instead of a 500", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Cursor guard.");

    const feed = await client.get("/api/posts/feed?cursor=not-an-object-id");
    expect(feed.status).toBe(422);
    expect(feed.body.error.code).toBe("VALIDATION_FAILED");
    expect(feed.body.error.fields.cursor).toBeDefined();

    const comments = await client.get(`/api/posts/${created._id}/comments?cursor=nope`);
    expect(comments.status).toBe(422);

    const followers = await client.get(`/api/users/${created.author._id}/followers?cursor=nope`);
    expect(followers.status).toBe(422);
  });
});

describe("social writes are session-scoped", () => {
  it("stops two separate sessions from sharing a cookie jar", async () => {
    const first = agent();
    const second = agent();

    await first.post("/api/auth/register").send({
      username: "sam",
      email: "sam@example.com",
      password: "password123",
    });
    await second.post("/api/auth/register").send({
      username: "rina",
      email: "rina@example.com",
      password: "password123",
    });

    const mine = await first.get("/api/auth/me");
    const theirs = await second.get("/api/auth/me");
    expect(mine.body.user.username).toBe("sam");
    expect(theirs.body.user.username).toBe("rina");
  });
});
