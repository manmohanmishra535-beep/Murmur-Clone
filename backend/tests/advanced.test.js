"use strict";

const http = require("http");
const { io: ioClient } = require("socket.io-client");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const Post = require("../models/Post");
const User = require("../models/User");
const { attach } = require("../realtime/io");
const { setIO } = require("../realtime/emitter");
const { app, anonymous, registerUser, findCookie } = require("./helpers");

const SECOND = { username: "arjun", email: "arjun@example.com", password: "password123" };
const THIRD = { username: "meera", email: "meera@example.com", password: "password123" };

/** Create a text post and return the serialized body. */
async function post(client, content) {
  const res = await client.post("/api/posts").field("content", content);
  expect(res.status).toBe(201);
  return res.body;
}

/** Create a post, then like it from another account, and return both sides. */
async function likedPost(content = "Trains were on time.", liker = SECOND) {
  const author = await registerUser();
  const created = await post(author.client, content);
  const other = await registerUser(liker);
  await other.client.post(`/api/posts/${created._id}/like`);
  return { author, created, other };
}

const MISSING_ID = "a".repeat(24);

describe("POST /api/posts/:id/repost", () => {
  it("requires a session", async () => {
    const res = await anonymous().post(`/api/posts/${MISSING_ID}/repost`);
    expect(res.status).toBe(401);
  });

  it("creates a post that points at the original and moves repostCount", async () => {
    const { client } = await registerUser();
    const original = await post(client, "The original.");

    const other = await registerUser(SECOND);
    const res = await other.client.post(`/api/posts/${original._id}/repost`).send({});

    expect(res.status).toBe(201);
    expect(res.body.content).toBe("");
    expect(res.body.repostOf._id).toBe(original._id);
    expect(res.body.repostOf.content).toBe("The original.");
    expect(res.body.repostedByMe).toBe(true);
    expect(res.body.repostOf.repostedByMe).toBe(true);

    const stored = await Post.findById(original._id).lean();
    expect(stored.repostCount).toBe(1);
  });

  it("accepts a comment on the repost", async () => {
    const { client } = await registerUser();
    const original = await post(client, "Worth sharing.");
    const other = await registerUser(SECOND);

    const res = await other.client
      .post(`/api/posts/${original._id}/repost`)
      .send({ content: "Everyone should read this." });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe("Everyone should read this.");
  });

  it("is idempotent: a repeat POST returns the existing repost with 200", async () => {
    const { client } = await registerUser();
    const original = await post(client, "Once.");
    const other = await registerUser(SECOND);

    const first = await other.client.post(`/api/posts/${original._id}/repost`).send({});
    const second = await other.client.post(`/api/posts/${original._id}/repost`).send({});

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body._id).toBe(first.body._id);

    expect(await Post.countDocuments({ repostOf: original._id })).toBe(1);
    const stored = await Post.findById(original._id).lean();
    expect(stored.repostCount).toBe(1);
  });

  it("resolves a repost of a repost to the original, so the graph stays flat", async () => {
    const { client } = await registerUser();
    const original = await post(client, "The root.");
    const second = await registerUser(SECOND);
    const third = await registerUser(THIRD);

    const repost = await second.client.post(`/api/posts/${original._id}/repost`).send({});
    const nested = await third.client.post(`/api/posts/${repost.body._id}/repost`).send({});

    expect(nested.status).toBe(201);
    expect(nested.body.repostOf._id).toBe(original._id);

    const stored = await Post.findById(original._id).lean();
    expect(stored.repostCount).toBe(2);
  });

  it("shows a repost in the followers' feed, carrying the original", async () => {
    const author = await registerUser(SECOND);
    const original = await post(author.client, "Followed content.");

    const follower = await registerUser();
    await follower.client.post(`/api/users/${author.user._id}/follow`);
    await author.client.post(`/api/posts/${original._id}/repost`).send({});

    const feed = await follower.client.get("/api/posts/feed");
    const repost = feed.body.items.find((item) => item.repostOf);

    expect(repost).toBeDefined();
    expect(repost.author.username).toBe("arjun");
    expect(repost.repostOf.content).toBe("Followed content.");
  });

  it("404s for a post that does not exist and 422s on content that is too long", async () => {
    const { client } = await registerUser();
    const missing = await client.post(`/api/posts/${MISSING_ID}/repost`).send({});
    expect(missing.status).toBe(404);

    const original = await post(client, "Short.");
    const other = await registerUser(SECOND);
    const long = await other.client
      .post(`/api/posts/${original._id}/repost`)
      .send({ content: "x".repeat(281) });

    expect(long.status).toBe(422);
    expect(long.body.error.fields.content).toBeDefined();
  });
});

describe("DELETE /api/posts/:id/repost", () => {
  it("removes the repost, moves the counter back and is safe to repeat", async () => {
    const { client } = await registerUser();
    const original = await post(client, "Removable.");
    const other = await registerUser(SECOND);
    const repost = await other.client.post(`/api/posts/${original._id}/repost`).send({});

    const first = await other.client.delete(`/api/posts/${original._id}/repost`);
    const second = await other.client.delete(`/api/posts/${original._id}/repost`);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(await Post.findById(repost.body._id)).toBeNull();

    const stored = await Post.findById(original._id).lean();
    expect(stored.repostCount).toBe(0);
  });

  it("accepts the repost's own id as well as the original's", async () => {
    const { client } = await registerUser();
    const original = await post(client, "Either id.");
    const other = await registerUser(SECOND);
    const repost = await other.client.post(`/api/posts/${original._id}/repost`).send({});

    const res = await other.client.delete(`/api/posts/${repost.body._id}/repost`);

    expect(res.status).toBe(204);
    expect((await Post.findById(original._id).lean()).repostCount).toBe(0);
  });

  it("leaves someone else's repost alone", async () => {
    const { client } = await registerUser();
    const original = await post(client, "Not yours.");
    const second = await registerUser(SECOND);
    const third = await registerUser(THIRD);

    await second.client.post(`/api/posts/${original._id}/repost`).send({});
    const res = await third.client.delete(`/api/posts/${original._id}/repost`);

    expect(res.status).toBe(204);
    expect((await Post.findById(original._id).lean()).repostCount).toBe(1);
  });

  it("removes reposts when the original post is deleted", async () => {
    const { client } = await registerUser();
    const original = await post(client, "Gone soon.");
    const other = await registerUser(SECOND);
    const repost = await other.client.post(`/api/posts/${original._id}/repost`).send({});

    await client.delete(`/api/posts/${original._id}`);

    expect(await Post.findById(repost.body._id)).toBeNull();
  });

  it("reports repostedByMe only for the viewer who reposted", async () => {
    const { client } = await registerUser();
    const original = await post(client, "Two views.");
    const other = await registerUser(SECOND);
    await other.client.post(`/api/posts/${original._id}/repost`).send({});

    const mine = await other.client.get(`/api/posts/${original._id}`);
    const theirs = await anonymous().get(`/api/posts/${original._id}`);

    expect(mine.body.repostedByMe).toBe(true);
    expect(theirs.body.repostedByMe).toBe(false);
  });
});

describe("bookmarks", () => {
  it("requires a session on every verb", async () => {
    const one = await anonymous().post(`/api/posts/${MISSING_ID}/bookmark`);
    const two = await anonymous().delete(`/api/posts/${MISSING_ID}/bookmark`);
    const three = await anonymous().get("/api/posts/bookmarks");

    expect(one.status).toBe(401);
    expect(two.status).toBe(401);
    expect(three.status).toBe(401);
  });

  it("saves and unsaves a post, idempotently", async () => {
    const { client, user } = await registerUser();
    const created = await post(client, "Keep this.");

    const saved = await client.post(`/api/posts/${created._id}/bookmark`);
    const again = await client.post(`/api/posts/${created._id}/bookmark`);
    expect(saved.body).toEqual({ bookmarked: true });
    expect(again.body).toEqual({ bookmarked: true });

    const stored = await User.findById(user._id).lean();
    expect(stored.bookmarks.map(String)).toEqual([created._id]);

    const removed = await client.delete(`/api/posts/${created._id}/bookmark`);
    const removedAgain = await client.delete(`/api/posts/${created._id}/bookmark`);
    expect(removed.body).toEqual({ bookmarked: false });
    expect(removedAgain.body).toEqual({ bookmarked: false });
  });

  it("lists the saved posts, newest first, and pages them", async () => {
    const { client } = await registerUser();
    const first = await post(client, "One.");
    const second = await post(client, "Two.");
    const third = await post(client, "Three.");

    for (const item of [first, second, third]) {
      await client.post(`/api/posts/${item._id}/bookmark`);
    }

    const page = await client.get("/api/posts/bookmarks?limit=2");
    expect(page.body.items.map((item) => item.content)).toEqual(["Three.", "Two."]);
    expect(page.body.nextCursor).toBe(second._id);

    const next = await client.get(`/api/posts/bookmarks?limit=2&cursor=${page.body.nextCursor}`);
    expect(next.body.items.map((item) => item.content)).toEqual(["One."]);
    expect(next.body.nextCursor).toBeNull();
  });

  it("answers an empty list for a user who has saved nothing", async () => {
    const { client } = await registerUser();
    const res = await client.get("/api/posts/bookmarks");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it("keeps bookmarks private and flags them only for the owner", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Private save.");
    await client.post(`/api/posts/${created._id}/bookmark`);

    const other = await registerUser(SECOND);
    const seen = await other.client.get(`/api/posts/${created._id}`);
    const mine = await client.get(`/api/posts/${created._id}`);

    expect(seen.body.bookmarkedByMe).toBe(false);
    expect(mine.body.bookmarkedByMe).toBe(true);
    expect(seen.body.bookmarks).toBeUndefined();

    const otherSaved = await other.client.get("/api/posts/bookmarks");
    expect(otherSaved.body.items).toHaveLength(0);
  });

  it("404s for a post that does not exist", async () => {
    const { client } = await registerUser();
    const res = await client.post(`/api/posts/${MISSING_ID}/bookmark`);
    expect(res.status).toBe(404);
  });
});

describe("notifications", () => {
  it("requires a session on every endpoint", async () => {
    const list = await anonymous().get("/api/notifications");
    const count = await anonymous().get("/api/notifications/unread-count");
    const read = await anonymous().patch("/api/notifications/read");

    expect(list.status).toBe(401);
    expect(count.status).toBe(401);
    expect(read.status).toBe(401);
  });

  it("records a like against the author, with the actor and the post", async () => {
    const { author, created, other } = await likedPost();

    const rows = await Notification.find({ recipient: author.user._id }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("like");
    expect(String(rows[0].actor)).toBe(other.user._id);
    expect(String(rows[0].post)).toBe(created._id);
    expect(rows[0].read).toBe(false);
  });

  it("never notifies you about your own post", async () => {
    const { client } = await registerUser();
    const created = await post(client, "Mine alone.");
    await client.post(`/api/posts/${created._id}/like`);

    expect(await Notification.countDocuments()).toBe(0);
  });

  it("takes the like notification back when the like is taken back", async () => {
    const { author, created, other } = await likedPost();

    await other.client.delete(`/api/posts/${created._id}/like`);
    expect(await Notification.countDocuments({ recipient: author.user._id })).toBe(0);

    const relike = await other.client.post(`/api/posts/${created._id}/like`);
    expect(relike.status).toBe(200);

    const rows = await Notification.find({ recipient: author.user._id }).lean();
    expect(rows).toHaveLength(1);
  });

  it("records a comment, a follow, a repost and a message", async () => {
    const author = await registerUser();
    const original = await post(author.client, "All four at once.");
    const other = await registerUser(SECOND);

    await other.client.post(`/api/posts/${original._id}/comments`).send({ content: "Nice." });
    await other.client.post(`/api/posts/${original._id}/repost`).send({});
    await other.client.post(`/api/posts/${original._id}/bookmark`);

    const conversation = await other.client.post("/api/conversations").send({
      userId: author.user._id,
    });
    await other.client
      .post(`/api/conversations/${conversation.body._id}/messages`)
      .send({ text: "Hello there." });

    const types = (await Notification.find({ recipient: author.user._id }).lean())
      .map((row) => row.type)
      .sort();
    expect(types).toEqual(["comment", "message", "repost"]);

    // A bookmark is private and notifies nobody.
    expect(types).not.toContain("bookmark");

    const followed = await registerUser(THIRD);
    await followed.client.post(`/api/users/${author.user._id}/follow`);
    const follow = await Notification.findOne({ recipient: author.user._id, type: "follow" });
    expect(follow).not.toBeNull();

    await followed.client.delete(`/api/users/${author.user._id}/follow`);
    expect(await Notification.countDocuments({ recipient: author.user._id, type: "follow" })).toBe(0);
  });

  it("returns the documented shape, newest first, and pages it", async () => {
    const { author, created, other } = await likedPost();

    const res = await other.client.get("/api/notifications");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);

    const list = await author.client.get("/api/notifications");
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].type).toBe("like");
    expect(list.body.items[0].actor.username).toBe("arjun");
    expect(list.body.items[0].post._id).toBe(created._id);
    expect(list.body.items[0].post.content).toBe("Trains were on time.");
    expect(list.body.nextCursor).toBeNull();

    const second = await registerUser(THIRD);
    await second.client.post(`/api/posts/${created._id}/like`);

    const paged = await author.client.get("/api/notifications?limit=1");
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.nextCursor).toBe(paged.body.items[0]._id);

    const rest = await author.client.get(`/api/notifications?cursor=${paged.body.nextCursor}`);
    expect(rest.body.items).toHaveLength(1);
  });

  it("counts unread rows and clears them on read", async () => {
    const { author, other } = await likedPost();

    const before = await author.client.get("/api/notifications/unread-count");
    expect(before.body).toEqual({ count: 1 });

    const marked = await author.client.patch("/api/notifications/read");
    expect(marked.status).toBe(204);

    const after = await author.client.get("/api/notifications/unread-count");
    expect(after.body).toEqual({ count: 0 });

    const list = await author.client.get("/api/notifications");
    expect(list.body.items[0].read).toBe(true);

    // The liker's own badge is untouched: this is the author's notification.
    const theirs = await other.client.get("/api/notifications/unread-count");
    expect(theirs.body).toEqual({ count: 0 });
  });

  it("removes notifications when the post they point at is deleted", async () => {
    const { author, created } = await likedPost();
    expect(await Notification.countDocuments()).toBe(1);

    await author.client.delete(`/api/posts/${created._id}`);

    expect(await Notification.countDocuments()).toBe(0);
  });

  it("422s on a malformed cursor, like every other list", async () => {
    const { client } = await registerUser();
    const res = await client.get("/api/notifications?cursor=not-an-id");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("GET /api/users/search", () => {
  it("requires a session", async () => {
    const res = await anonymous().get("/api/users/search?q=pri");
    expect(res.status).toBe(401);
  });

  it("matches a username prefix, case-insensitively", async () => {
    await registerUser({ username: "priya", email: "priya@example.com" });
    await registerUser({ username: "arjun", email: "arjun@example.com" });

    const client = (await registerUser({ username: "meera", email: "meera@example.com" })).client;
    const res = await client.get("/api/users/search?q=PRI");

    expect(res.status).toBe(200);
    expect(res.body.items.map((user) => user.username)).toEqual(["priya"]);
  });

  it("matches a whole word inside the display name", async () => {
    const { client, user } = await registerUser({ username: "priya", email: "priya@example.com" });
    await client.patch("/api/users/me").send({ displayName: "Priya Raman" });

    const other = (await registerUser({ username: "arjun", email: "arjun@example.com" })).client;
    const res = await other.get("/api/users/search?q=Raman");

    expect(res.body.items.map((item) => item._id)).toContain(user._id);
  });

  it("caps the answer at ten accounts and never leaks private fields", async () => {
    for (let index = 0; index < 12; index += 1) {
      // eslint-disable-next-line no-await-in-loop -- one account at a time keeps this readable.
      await registerUser({ username: `tester${index}`, email: `tester${index}@example.com` });
    }
    const { client } = await registerUser({ username: "meera", email: "meera@example.com" });

    const res = await client.get("/api/users/search?q=tester");
    expect(res.body.items).toHaveLength(10);

    for (const item of res.body.items) {
      expect(item.password).toBeUndefined();
      expect(item.email).toBeUndefined();
      expect(item.bookmarks).toBeUndefined();
    }
  });

  it("answers an empty list for an empty term", async () => {
    const { client } = await registerUser();
    const res = await client.get("/api/users/search?q=");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it("treats a regex metacharacter as a literal character", async () => {
    await registerUser({ username: "priya", email: "priya@example.com" });
    const { client } = await registerUser({ username: "meera", email: "meera@example.com" });

    const res = await client.get("/api/users/search?q=(");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});

describe("GET /api/users/suggested", () => {
  it("requires a session", async () => {
    const res = await anonymous().get("/api/users/suggested");
    expect(res.status).toBe(401);
  });

  it("leaves out the viewer and the accounts they already follow", async () => {
    const followed = await registerUser(SECOND);
    const stranger = await registerUser(THIRD);
    const { client, user } = await registerUser();

    await client.post(`/api/users/${followed.user._id}/follow`);

    const res = await client.get("/api/users/suggested");
    const ids = res.body.items.map((item) => item._id);

    expect(ids).toContain(stranger.user._id);
    expect(ids).not.toContain(followed.user._id);
    expect(ids).not.toContain(user._id);
    expect(res.body.items.every((item) => item.isFollowing === false)).toBe(true);
  });

  it("sorts the most followed accounts first", async () => {
    const popular = await registerUser(SECOND);
    const quiet = await registerUser(THIRD);

    for (const seed of ["a", "b", "c"]) {
      // eslint-disable-next-line no-await-in-loop -- one follower at a time keeps this readable.
      const follower = await registerUser({ username: `fan${seed}`, email: `fan${seed}@example.com` });
      // eslint-disable-next-line no-await-in-loop
      await follower.client.post(`/api/users/${popular.user._id}/follow`);
    }

    const { client } = await registerUser();
    const res = await client.get("/api/users/suggested");

    const ids = res.body.items.map((item) => item._id);
    expect(ids).toContain(popular.user._id);
    expect(ids).toContain(quiet.user._id);
    expect(ids.indexOf(popular.user._id)).toBeLessThan(ids.indexOf(quiet.user._id));
  });
});

describe("conversations and messages", () => {
  it("requires a session", async () => {
    const inbox = await anonymous().get("/api/conversations");
    const start = await anonymous().post("/api/conversations").send({ userId: MISSING_ID });

    expect(inbox.status).toBe(401);
    expect(start.status).toBe(401);
  });

  it("opens a conversation with someone, then returns the same one", async () => {
    const first = await registerUser();
    const second = await registerUser(SECOND);

    const created = await first.client.post("/api/conversations").send({ userId: second.user._id });
    expect(created.status).toBe(200);
    expect(created.body.other.username).toBe("arjun");
    expect(created.body.lastMessage).toBeNull();

    const again = await first.client.post("/api/conversations").send({ userId: second.user._id });
    expect(again.body._id).toBe(created.body._id);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it("refuses a conversation with yourself and with a stranger", async () => {
    const { client, user } = await registerUser();

    const self = await client.post("/api/conversations").send({ userId: user._id });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe("SELF_CONVERSATION");

    const missing = await client.post("/api/conversations").send({ userId: MISSING_ID });
    expect(missing.status).toBe(404);

    const malformed = await client.post("/api/conversations").send({ userId: "nope" });
    expect(malformed.status).toBe(422);
  });

  it("writes a message, moves lastMessage and lists the inbox newest first", async () => {
    const first = await registerUser();
    const second = await registerUser(SECOND);
    const third = await registerUser(THIRD);

    const older = await first.client.post("/api/conversations").send({ userId: second.user._id });
    const newer = await first.client.post("/api/conversations").send({ userId: third.user._id });

    await first.client
      .post(`/api/conversations/${older.body._id}/messages`)
      .send({ text: "Hello arjun." });
    await first.client
      .post(`/api/conversations/${newer.body._id}/messages`)
      .send({ text: "Hello meera." });

    const inbox = await first.client.get("/api/conversations");
    expect(inbox.body.nextCursor).toBeNull();
    expect(inbox.body.items[0]._id).toBe(newer.body._id);
    expect(inbox.body.items[0].lastMessage.text).toBe("Hello meera.");
    expect(inbox.body.items[0].other.username).toBe("meera");

    // The other side sees the same conversation from their point of view.
    const theirs = await second.client.get("/api/conversations");
    expect(theirs.body.items[0].other.username).toBe("priya");
  });

  it("lists messages newest first and pages them", async () => {
    const first = await registerUser();
    const second = await registerUser(SECOND);
    const conversation = await first.client
      .post("/api/conversations")
      .send({ userId: second.user._id });

    for (const text of ["one", "two", "three"]) {
      // eslint-disable-next-line no-await-in-loop -- order matters for this assertion.
      await first.client.post(`/api/conversations/${conversation.body._id}/messages`).send({ text });
    }

    const page = await first.client.get(
      `/api/conversations/${conversation.body._id}/messages?limit=2`
    );
    expect(page.body.items.map((item) => item.text)).toEqual(["three", "two"]);
    expect(page.body.nextCursor).toBeTruthy();

    const rest = await first.client.get(
      `/api/conversations/${conversation.body._id}/messages?cursor=${page.body.nextCursor}`
    );
    expect(rest.body.items.map((item) => item.text)).toEqual(["one"]);

    const stored = await Message.find({ conversation: conversation.body._id }).lean();
    expect(stored).toHaveLength(3);
  });

  it("keeps a conversation to its two participants", async () => {
    const first = await registerUser();
    const second = await registerUser(SECOND);
    const stranger = await registerUser(THIRD);

    const conversation = await first.client
      .post("/api/conversations")
      .send({ userId: second.user._id });

    const read = await stranger.client.get(
      `/api/conversations/${conversation.body._id}/messages`
    );
    const write = await stranger.client
      .post(`/api/conversations/${conversation.body._id}/messages`)
      .send({ text: "Let me in." });

    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
  });

  it("422s on empty and oversized text, and 404s on an unknown conversation", async () => {
    const first = await registerUser();
    const second = await registerUser(SECOND);
    const conversation = await first.client
      .post("/api/conversations")
      .send({ userId: second.user._id });

    const empty = await first.client
      .post(`/api/conversations/${conversation.body._id}/messages`)
      .send({ text: "   " });
    expect(empty.status).toBe(422);

    const long = await first.client
      .post(`/api/conversations/${conversation.body._id}/messages`)
      .send({ text: "x".repeat(2001) });
    expect(long.status).toBe(422);

    const missing = await first.client
      .post(`/api/conversations/${MISSING_ID}/messages`)
      .send({ text: "Anyone?" });
    expect(missing.status).toBe(404);
  });
});

describe("realtime", () => {
  let server;
  let io;
  let url;

  beforeAll(async () => {
    server = http.createServer(app);
    io = attach(server);
    await new Promise((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    // Leave the process clean for the next test file: no socket, no listener.
    setIO(null);
    await new Promise((resolve) => io.close(resolve));
  });

  /**
   * Connect with the same httpOnly token cookie the REST API handed out.
   * `registerUser` returns the register response, which carries it.
   */
  function connect(session, headerCookie) {
    const cookie =
      headerCookie === undefined && session ? findCookie(session.res, "token") : headerCookie;
    const socket = ioClient(url, {
      transports: ["websocket"],
      extraHeaders: cookie ? { cookie } : {},
      reconnection: false,
    });
    return new Promise((resolve, reject) => {
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (error) => {
        socket.close();
        reject(error);
      });
    });
  }

  /** Resolve with the next payload for an event, or reject on a timeout. */
  function nextEvent(socket, event) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 5000);
      socket.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  it("rejects a handshake with no token cookie", async () => {
    await expect(connect(null)).rejects.toThrow("UNAUTHENTICATED");
  });

  it("rejects a handshake whose token is not a real one", async () => {
    await expect(connect(null, "token=not.a.token")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("accepts the same cookie the REST API issued", async () => {
    const author = await registerUser();
    const socket = await connect(author);
    expect(socket.connected).toBe(true);
    socket.close();
  });

  it("refuses a socket whose cookie predates a password reset", async () => {
    const author = await registerUser();
    const staleCookie = findCookie(author.res, "token");

    const forgot = await anonymous()
      .post("/api/auth/forgot-password")
      .send({ email: author.payload.email });
    const token = new URL(forgot.body.resetUrl).searchParams.get("token");

    await anonymous()
      .post("/api/auth/reset-password")
      .send({ token, password: "brand-new-pass" });

    // The handshake runs the same generation check as req.user, so an open
    // session cannot outlive the password it was authenticated with.
    await expect(connect(null, staleCookie)).rejects.toThrow("UNAUTHENTICATED");
  });

  it("pushes notification:new when someone likes your post, with no refresh", async () => {
    const author = await registerUser();
    const created = await post(author.client, "This one will be liked.");
    const liker = await registerUser(SECOND);

    // The author is the recipient, so the author's own socket is the one to watch.
    const socket = await connect(author);
    const arrival = nextEvent(socket, "notification:new");

    // The like is an ordinary REST call; only the push is realtime.
    const liked = await liker.client.post(`/api/posts/${created._id}/like`);
    expect(liked.status).toBe(200);

    const notification = await arrival;

    expect(notification.type).toBe("like");
    expect(notification.read).toBe(false);
    expect(notification.actor.username).toBe("arjun");
    expect(notification.post._id).toBe(created._id);
    expect(notification.post.content).toBe("This one will be liked.");

    socket.close();
  });

  it("keeps the push inside the recipient's room", async () => {
    const author = await registerUser();
    const created = await post(author.client, "Not for everyone.");
    const liker = await registerUser(SECOND);
    const bystander = await registerUser(THIRD);

    const watcher = await connect(bystander);
    let leaked = false;
    watcher.on("notification:new", () => {
      leaked = true;
    });

    await liker.client.post(`/api/posts/${created._id}/like`);
    // The author's row is stored, and nothing reached the third party.
    const stored = await Notification.countDocuments({ recipient: author.user._id });
    expect(stored).toBe(1);
    expect(leaked).toBe(false);

    watcher.close();
  });

  it("pushes notification:remove when the like is taken back", async () => {
    const author = await registerUser();
    const created = await post(author.client, "Flipped.");
    const liker = await registerUser(SECOND);

    await liker.client.post(`/api/posts/${created._id}/like`);

    const socket = await connect(author);
    const removed = nextEvent(socket, "notification:remove");

    await liker.client.delete(`/api/posts/${created._id}/like`);
    const payload = await removed;

    const row = await Notification.findById(payload._id).lean();
    expect(row).toBeNull();

    socket.close();
  });

  it("pushes post:counts to the author as likes land", async () => {
    const author = await registerUser();
    const created = await post(author.client, "Counted live.");
    const liker = await registerUser(SECOND);

    const socket = await connect(author);
    const counts = nextEvent(socket, "post:counts");

    await liker.client.post(`/api/posts/${created._id}/like`);
    const payload = await counts;

    expect(payload.postId).toBe(created._id);
    expect(payload.likeCount).toBe(1);
    expect(payload.commentCount).toBe(0);

    socket.close();
  });

  it("stores a socket-sent message and pushes it to both participants", async () => {
    const first = await registerUser();
    const second = await registerUser(SECOND);
    const conversation = await first.client
      .post("/api/conversations")
      .send({ userId: second.user._id });

    const recipient = await connect(second);
    const arrival = nextEvent(recipient, "message:new");
    const sender = await connect(first);

    const ack = await new Promise((resolve) => {
      sender.emit(
        "message:send",
        { conversationId: conversation.body._id, text: "Over the wire." },
        resolve
      );
    });

    expect(ack.ok).toBe(true);
    expect(ack.message.text).toBe("Over the wire.");

    const pushed = await arrival;
    expect(pushed.text).toBe("Over the wire.");
    expect(pushed.sender.username).toBe("priya");
    expect(pushed.conversation).toBe(conversation.body._id);

    const stored = await Message.find({ conversation: conversation.body._id }).lean();
    expect(stored).toHaveLength(1);

    // The recipient gets one notification for the message, like the REST path.
    const notified = await Notification.findOne({ recipient: second.user._id }).lean();
    expect(notified.type).toBe("message");

    sender.close();
    recipient.close();
  });

  it("answers a failed socket send with an error instead of throwing", async () => {
    const socket = await connect(await registerUser());

    const ack = await new Promise((resolve) => {
      socket.emit("message:send", { conversationId: MISSING_ID, text: "Anyone?" }, resolve);
    });

    expect(ack.ok).toBe(false);
    expect(ack.error.code).toBe("NOT_FOUND");

    socket.close();
  });

  it("forwards typing to the other participant only", async () => {
    const first = await registerUser();
    const second = await registerUser(SECOND);
    const conversation = await first.client
      .post("/api/conversations")
      .send({ userId: second.user._id });

    const sender = await connect(first);
    const peer = await connect(second);

    const typing = nextEvent(peer, "typing:start");
    sender.emit("typing:start", { conversationId: conversation.body._id });

    const payload = await typing;
    expect(payload.conversationId).toBe(conversation.body._id);
    expect(payload.userId).toBe(first.user._id);

    // Nothing was stored: typing is presence, not data.
    expect(await Message.countDocuments()).toBe(0);

    sender.close();
    peer.close();
  });
});
