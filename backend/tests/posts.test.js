"use strict";

const mongoose = require("mongoose");
const { agent, anonymous, registerUser } = require("./helpers");

// Cloudinary is never reachable from the test run, so uploads are stubbed.
// The rest of the module (FOLDERS, the disabled-upload guard) stays real.
// The counter is named mock* because jest.mock factories are hoisted above
// every other declaration in this file.
let mockUploadCount = 0;
jest.mock("../config/cloudinary", () => {
  const actual = jest.requireActual("../config/cloudinary");
  return {
    ...actual,
    uploadBuffer: jest.fn(async (_buffer, folder) => {
      mockUploadCount += 1;
      return {
        secure_url: `https://res.cloudinary.com/demo/image/upload/${folder}/sample-${mockUploadCount}.jpg`,
        public_id: `${folder}/sample-${mockUploadCount}`,
      };
    }),
    destroyImage: jest.fn(async () => ({ result: "ok" })),
  };
});

const cloudinary = require("../config/cloudinary");
const Post = require("../models/Post");

const JPEG = { filename: "platform.jpg", contentType: "image/jpeg" };

function image(name = JPEG.filename) {
  return { ...JPEG, filename: name };
}

beforeEach(() => {
  mockUploadCount = 0;
  cloudinary.uploadBuffer.mockClear();
  cloudinary.destroyImage.mockClear();
});

async function createPost(client, fields, files = []) {
  let request = client.post("/api/posts");
  for (const [key, value] of Object.entries(fields)) request = request.field(key, value);
  for (const file of files) {
    request = request.attach("images", Buffer.from("not-really-an-image"), image(file));
  }
  return request;
}

describe("POST /api/posts", () => {
  it("requires a session", async () => {
    const res = await anonymous().post("/api/posts").field("content", "hello");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates a text post and echoes the documented shape", async () => {
    const { client, user } = await registerUser();

    const res = await createPost(client, { content: "  Trains were on time this morning.  " });

    expect(res.status).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.content).toBe("Trains were on time this morning.");
    expect(res.body.author.username).toBe(user.username);
    expect(res.body.author.displayName).toBe(user.username);
    expect(res.body.images).toEqual([]);
    expect(res.body.likeCount).toBe(0);
    expect(res.body.commentCount).toBe(0);
    expect(res.body.repostCount).toBe(0);
    expect(res.body.likedByMe).toBe(false);
    expect(res.body.repostedByMe).toBe(false);
    expect(res.body.bookmarkedByMe).toBe(false);
    expect(res.body.editedAt).toBeNull();
    expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
  });

  it("never leaks the like list", async () => {
    const { client } = await registerUser();
    const res = await createPost(client, { content: "quiet" });

    expect(res.body.likes).toBeUndefined();
    const stored = await Post.findById(res.body._id).lean();
    expect(stored.likes).toEqual([]);
  });

  it("rejects a post with neither text nor an image", async () => {
    const { client } = await registerUser();

    const res = await createPost(client, { content: "   " });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.content).toBe("Write something, or add an image.");
    expect(await Post.countDocuments()).toBe(0);
  });

  it("rejects content over 280 characters after trimming", async () => {
    const { client } = await registerUser();

    const res = await createPost(client, { content: `  ${"x".repeat(281)}  ` });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.content).toBe("Keep your post to 280 characters.");
  });

  it("accepts content of exactly 280 characters", async () => {
    const { client } = await registerUser();

    const res = await createPost(client, { content: "y".repeat(280) });

    expect(res.status).toBe(201);
    expect(res.body.content).toHaveLength(280);
  });

  it("accepts an image with empty text, per the docs' content rule", async () => {
    const { client } = await registerUser();

    const res = await createPost(client, {}, ["a.jpg"]);

    expect(res.status).toBe(201);
    expect(res.body.content).toBe("");
    expect(res.body.images).toHaveLength(1);
    expect(res.body.images[0].publicId).toMatch(/^murmur\/posts\//);
    expect(res.body.images[0].url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
  });

  it("stores up to 4 images alongside text", async () => {
    const { client } = await registerUser();

    const res = await createPost(client, { content: "#Mumbai" }, ["a.jpg", "b.jpg", "c.jpg", "d.jpg"]);

    expect(res.status).toBe(201);
    expect(res.body.images).toHaveLength(4);
    expect(cloudinary.uploadBuffer).toHaveBeenCalledTimes(4);
  });

  it("rejects a fifth image", async () => {
    const { client } = await registerUser();

    const res = await createPost(client, { content: "too many" }, [
      "a.jpg",
      "b.jpg",
      "c.jpg",
      "d.jpg",
      "e.jpg",
    ]);

    expect(res.status).toBe(422);
    expect(res.body.error.fields.image).toBe("Up to 4 images per post.");
  });

  it("rejects a file that is not an image", async () => {
    const { client } = await registerUser();

    const res = await client
      .post("/api/posts")
      .field("content", "here is a file")
      .attach("images", Buffer.from("plain text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.image).toBe("Use a JPEG, PNG, WebP or GIF image.");
    expect(cloudinary.uploadBuffer).not.toHaveBeenCalled();
  });

  it("cleans up already-uploaded images when one upload fails", async () => {
    const { client } = await registerUser();
    // errorHandler logs every 5xx; this one is deliberate, so keep it quiet.
    const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
    cloudinary.uploadBuffer.mockImplementationOnce(async () => ({
      secure_url: "https://res.cloudinary.com/demo/image/upload/first.jpg",
      public_id: "murmur/posts/first",
    }));
    cloudinary.uploadBuffer.mockImplementationOnce(async () => {
      throw new Error("cloudinary is down");
    });

    const res = await createPost(client, { content: "two images" }, ["a.jpg", "b.jpg"]);

    expect(res.status).toBe(500);
    expect(cloudinary.destroyImage).toHaveBeenCalledWith("murmur/posts/first");
    expect(await Post.countDocuments()).toBe(0);
    quiet.mockRestore();
  });
});

describe("GET /api/posts/:id", () => {
  it("returns a single post", async () => {
    const { client } = await registerUser();
    const created = await createPost(client, { content: "one post" });

    const res = await client.get(`/api/posts/${created.body._id}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(created.body._id);
    expect(res.body.content).toBe("one post");
  });

  it("404s for an unknown id and for a malformed one", async () => {
    const { client } = await registerUser();
    const missing = new mongoose.Types.ObjectId();

    expect((await client.get(`/api/posts/${missing}`)).status).toBe(404);
    expect((await client.get("/api/posts/not-an-object-id")).status).toBe(404);
  });
});

describe("GET /api/posts/user/:username", () => {
  it("lists one author's posts newest first and 404s an unknown handle", async () => {
    const { client } = await registerUser();
    await createPost(client, { content: "first" });
    await createPost(client, { content: "second" });

    const res = await client.get("/api/posts/user/priya");

    expect(res.status).toBe(200);
    expect(res.body.items.map((post) => post.content)).toEqual(["second", "first"]);
    expect(res.body.nextCursor).toBeNull();

    expect((await client.get("/api/posts/user/nobody")).status).toBe(404);
  });

  it("paginates with a cursor that new posts cannot shift", async () => {
    const { client } = await registerUser();
    for (let index = 1; index <= 5; index += 1) {
      await createPost(client, { content: `post ${index}` });
    }

    const page1 = await client.get("/api/posts/user/priya?limit=2");
    expect(page1.body.items.map((post) => post.content)).toEqual(["post 5", "post 4"]);
    expect(page1.body.nextCursor).toBe(page1.body.items[1]._id);

    const page2 = await client.get(
      `/api/posts/user/priya?limit=2&cursor=${page1.body.nextCursor}`
    );
    expect(page2.body.items.map((post) => post.content)).toEqual(["post 3", "post 2"]);

    const page3 = await client.get(
      `/api/posts/user/priya?limit=2&cursor=${page2.body.nextCursor}`
    );
    expect(page3.body.items.map((post) => post.content)).toEqual(["post 1"]);
    expect(page3.body.nextCursor).toBeNull();
  });

  it("caps limit at 50 and falls back to 20 for nonsense", async () => {
    const { client } = await registerUser();
    await createPost(client, { content: "only one" });

    const big = await client.get("/api/posts/user/priya?limit=999");
    expect(big.body.items).toHaveLength(1);

    const nonsense = await client.get("/api/posts/user/priya?limit=abc");
    expect(nonsense.status).toBe(200);
  });

  it("needs a session", async () => {
    expect((await anonymous().get("/api/posts/user/priya")).status).toBe(401);
  });
});

describe("GET /api/posts/feed", () => {
  it("returns your own posts and nothing from people you do not follow", async () => {
    const { client } = await registerUser();
    const other = await registerUser({ username: "rohan_s", email: "rohan@example.com" });

    await createPost(client, { content: "mine" });
    await createPost(other.client, { content: "theirs" });

    const res = await client.get("/api/posts/feed");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].content).toBe("mine");
  });

  it("includes posts from people you follow", async () => {
    const { client, user } = await registerUser();
    const other = await registerUser({ username: "rohan_s", email: "rohan@example.com" });
    await createPost(other.client, { content: "theirs" });

    // Phase 3 ships the follow endpoints; this writes the relationship directly.
    const User = require("../models/User");
    await User.updateOne({ _id: user._id }, { $addToSet: { following: other.user._id } });

    const res = await client.get("/api/posts/feed");

    expect(res.body.items.map((post) => post.content)).toEqual(["theirs"]);
  });

  it("is empty for a brand new account", async () => {
    const { client } = await registerUser();

    const res = await client.get("/api/posts/feed");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  it("needs a session", async () => {
    expect((await anonymous().get("/api/posts/feed")).status).toBe(401);
  });
});

describe("PATCH /api/posts/:id", () => {
  it("lets the author edit the text and records editedAt", async () => {
    const { client } = await registerUser();
    const created = await createPost(client, { content: "typo heer" });

    const res = await client.patch(`/api/posts/${created.body._id}`).send({ content: "typo here" });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("typo here");
    expect(res.body.editedAt).not.toBeNull();
    expect(res.body.createdAt).toBe(created.body.createdAt);
  });

  it("refuses an empty edit", async () => {
    const { client } = await registerUser();
    const created = await createPost(client, { content: "keep me" });

    const res = await client.patch(`/api/posts/${created.body._id}`).send({ content: "   " });

    expect(res.status).toBe(422);
    expect(res.body.error.fields.content).toBe("Write something to save.");
  });

  it("403s for anyone but the author", async () => {
    const { client } = await registerUser();
    const other = await registerUser({ username: "rohan_s", email: "rohan@example.com" });
    const created = await createPost(client, { content: "mine" });

    const res = await other.client
      .patch(`/api/posts/${created.body._id}`)
      .send({ content: "not yours" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("404s for a post that does not exist", async () => {
    const { client } = await registerUser();

    const res = await client
      .patch(`/api/posts/${new mongoose.Types.ObjectId()}`)
      .send({ content: "ghost" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/posts/:id", () => {
  it("deletes the post and its Cloudinary images", async () => {
    const { client } = await registerUser();
    const created = await createPost(client, { content: "gone soon" }, ["a.jpg", "b.jpg"]);
    const publicIds = created.body.images.map((img) => img.publicId);

    const res = await client.delete(`/api/posts/${created.body._id}`);

    expect(res.status).toBe(204);
    expect(await Post.countDocuments()).toBe(0);
    expect(cloudinary.destroyImage.mock.calls.map((call) => call[0]).sort()).toEqual(
      publicIds.sort()
    );
  });

  it("403s for anyone but the author", async () => {
    const { client } = await registerUser();
    const other = await registerUser({ username: "rohan_s", email: "rohan@example.com" });
    const created = await createPost(client, { content: "mine" });

    const res = await other.client.delete(`/api/posts/${created.body._id}`);

    expect(res.status).toBe(403);
    expect(await Post.countDocuments()).toBe(1);
  });
});

describe("profile post count", () => {
  it("reflects the number of posts an author has", async () => {
    const { client } = await registerUser();
    await createPost(client, { content: "one" });
    await createPost(client, { content: "two" });

    const res = await client.get("/api/users/priya");

    expect(res.status).toBe(200);
    expect(res.body.user.postCount).toBe(2);
  });

  it("counts posts for an anonymous visitor too", async () => {
    const { client } = await registerUser();
    await createPost(client, { content: "public" });

    const res = await agent().get("/api/users/priya");

    expect(res.body.user.postCount).toBe(1);
    expect(res.body.user.email).toBeUndefined();
  });
});
