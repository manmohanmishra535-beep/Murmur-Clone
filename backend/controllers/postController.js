"use strict";

const Post = require("../models/Post");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { assertOwner } = require("../middleware/auth");
const { serializePost, paginated } = require("../utils/serialize");
const { uploadBuffer, destroyImage, FOLDERS } = require("../config/cloudinary");
const { parseLimit, paginate, cursorFilter } = require("../utils/pagination");

// Only the fields a post header renders; a feed must not drag whole profiles.
const AUTHOR_FIELDS = "username displayName profileImage";

/** Every read of a post loads its author, and a repost's author too. */
function populatePost(query) {
  return query
    .populate("author", AUTHOR_FIELDS)
    .populate({ path: "repostOf", populate: { path: "author", select: AUTHOR_FIELDS } });
}

/**
 * Stream every memory buffer to Cloudinary. If one fails, the ones already
 * uploaded are removed so a failed create never leaves orphans behind.
 */
async function uploadPostImages(files) {
  const images = [];
  try {
    for (const file of files) {
      const uploaded = await uploadBuffer(file.buffer, FOLDERS.posts);
      images.push({ url: uploaded.secure_url, publicId: uploaded.public_id });
    }
    return images;
  } catch (error) {
    await Promise.all(images.map((image) => destroyImage(image.publicId)));
    throw error;
  }
}

/** POST /api/posts - text, up to 4 images, or both. */
const createPost = asyncHandler(async (req, res) => {
  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
  const images = await uploadPostImages(Array.isArray(req.files) ? req.files : []);

  const post = await Post.create({ author: req.user._id, content, images });
  await post.populate("author", AUTHOR_FIELDS);

  res.status(201).json(serializePost(post, { viewer: req.user }));
});

/** GET /api/posts/:id - a single post. A malformed id is a 404, not a crash. */
const getPost = asyncHandler(async (req, res) => {
  const post = await populatePost(Post.findById(req.params.id));
  if (!post) throw AppError.notFound("That post does not exist.");

  res.status(200).json(serializePost(post, { viewer: req.user }));
});

/** GET /api/posts/user/:username - one author's timeline, newest first. */
const listUserPosts = asyncHandler(async (req, res) => {
  const username = String(req.params.username || "").toLowerCase();

  const author = await User.findOne({ username }).select("_id");
  if (!author) throw AppError.notFound("That account does not exist.");

  const limit = parseLimit(req.query.limit);
  const docs = await populatePost(
    Post.find({ author: author._id, ...cursorFilter(req.query.cursor) })
      .sort({ _id: -1 })
      .limit(limit + 1)
  );

  const { items, nextCursor } = paginate(docs, limit);
  res
    .status(200)
    .json(paginated(items, nextCursor, (post) => serializePost(post, { viewer: req.user })));
});

/**
 * GET /api/posts/feed - the home timeline: people you follow, plus yourself.
 * Until following lands in Phase 3 the following list is empty, so this is
 * simply your own posts, newest first.
 */
const getFeed = asyncHandler(async (req, res) => {
  const authors = [...(req.user.following || []), req.user._id];
  const limit = parseLimit(req.query.limit);

  const docs = await populatePost(
    Post.find({ author: { $in: authors }, ...cursorFilter(req.query.cursor) })
      .sort({ _id: -1 })
      .limit(limit + 1)
  );

  const { items, nextCursor } = paginate(docs, limit);
  res
    .status(200)
    .json(paginated(items, nextCursor, (post) => serializePost(post, { viewer: req.user })));
});

/** PATCH /api/posts/:id - the author edits the text; editedAt records when. */
const updatePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  assertOwner(post, req.user._id, "post");

  post.content = req.body.content.trim();
  post.editedAt = new Date();
  await post.save();
  await post.populate("author", AUTHOR_FIELDS);

  res.status(200).json(serializePost(post, { viewer: req.user }));
});

/**
 * DELETE /api/posts/:id - removes the post and its Cloudinary assets.
 * Phase 3 also removes the post's comments, and Phase 4 its notifications.
 */
const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  assertOwner(post, req.user._id, "post");

  const publicIds = (post.images || []).map((image) => image.publicId).filter(Boolean);
  await post.deleteOne();
  await Promise.all(publicIds.map((publicId) => destroyImage(publicId)));

  res.status(204).end();
});

module.exports = {
  createPost,
  getPost,
  listUserPosts,
  getFeed,
  updatePost,
  deletePost,
};
