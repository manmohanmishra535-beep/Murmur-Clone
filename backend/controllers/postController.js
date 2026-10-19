"use strict";

const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const Notification = require("../models/Notification");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { assertOwner } = require("../middleware/auth");
const { serializePost, paginated } = require("../utils/serialize");
const { notify, removeNotification } = require("../utils/notify");
const { emitToUser } = require("../realtime/emitter");
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
 * Which posts the viewer has already reposted.
 *
 * The docs' Post schema carries repostCount but no reposts array, so the flag a
 * repost button reads cannot come from the document. Resolving it for a whole
 * page in one query keeps a 20-post feed at two reads instead of twenty.
 *
 * A repost points at an original, so a page offers both kinds of id: the post
 * itself and, for a repost, the original it carries. Querying on both means the
 * repost button reads "pressed" whether the viewer is looking at the original or
 * at a repost of it.
 */
async function viewerReposts(viewer, posts) {
  if (!viewer || posts.length === 0) return new Set();

  const ids = posts.flatMap((post) => {
    const original = post.repostOf ? post.repostOf._id || post.repostOf : null;
    return original ? [post._id, original] : [post._id];
  });

  const rows = await Post.find({ author: viewer._id, repostOf: { $in: ids } }).select("repostOf");
  return new Set(rows.map((row) => String(row.repostOf)));
}

/** Serialize a page of posts, repost flags and all. */
async function serializePosts(posts, nextCursor, viewer) {
  const reposted = await viewerReposts(viewer, posts);
  return paginated(posts, nextCursor, (post) => serializePost(post, { viewer, reposted }));
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

  const reposted = await viewerReposts(req.user, [post]);
  res.status(200).json(serializePost(post, { viewer: req.user, reposted }));
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
  res.status(200).json(await serializePosts(items, nextCursor, req.user));
});

/**
 * GET /api/posts/feed - the home timeline: people you follow, plus yourself.
 * A repost is a post by the author, so it reaches their followers here too and
 * carries the original in repostOf for the card to render.
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
  res.status(200).json(await serializePosts(items, nextCursor, req.user));
});

/**
 * GET /api/posts/explore - newest posts from everyone, cursor paginated.
 * The API reference lists it beside /feed. The delivery table files "search"
 * under Phase 4, but the home screen has shipped a "For you" tab since Phase 1,
 * and a tab that leads nowhere is worse than an endpoint arriving early.
 */
const getExplore = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const docs = await populatePost(
    Post.find({ ...cursorFilter(req.query.cursor) })
      .sort({ _id: -1 })
      .limit(limit + 1)
  );

  const { items, nextCursor } = paginate(docs, limit);
  res.status(200).json(await serializePosts(items, nextCursor, req.user));
});

/** PATCH /api/posts/:id - the author edits the text; editedAt records when. */
const updatePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  assertOwner(post, req.user._id, "post");

  post.content = req.body.content.trim();
  post.editedAt = new Date();
  await post.save();
  await post.populate("author", AUTHOR_FIELDS);

  const reposted = await viewerReposts(req.user, [post]);
  res.status(200).json(serializePost(post, { viewer: req.user, reposted }));
});

/**
 * DELETE /api/posts/:id - removes the post, its comments, its reposts, the
 * notifications that pointed at any of them, and its Cloudinary assets.
 *
 * A repost of a deleted post has nothing left to show, so it goes too rather
 * than lingering as a card pointing at a hole.
 */
const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  assertOwner(post, req.user._id, "post");

  const reposts = await Post.find({ repostOf: post._id }).select("_id");
  const related = [post._id, ...reposts.map((repost) => repost._id)];

  const publicIds = [
    ...(post.images || []).map((image) => image.publicId),
    ...reposts.flatMap((repost) => (repost.images || []).map((image) => image.publicId)),
  ].filter(Boolean);

  await Promise.all([
    Comment.deleteMany({ post: { $in: related } }),
    Notification.deleteMany({ post: { $in: related } }),
    Post.deleteMany({ repostOf: post._id }),
    post.deleteOne(),
  ]);
  await Promise.all(publicIds.map((publicId) => destroyImage(publicId)));

  res.status(204).end();
});

/** Loads a post for the write routes, or 404s. */
async function requirePost(id) {
  const post = await Post.findById(id).select("likes likeCount author");
  if (!post) throw AppError.notFound("That post does not exist.");
  return post;
}

/**
 * Push the authoritative counters to the author's room, so the copy of their
 * own post they are looking at stays live. The same numbers come back to the
 * caller, so the response and the push can never disagree.
 */
async function pushCounts(postId, recipient) {
  const fresh = await Post.findById(postId).select("likeCount commentCount repostCount");
  const counts = {
    postId: String(postId),
    likeCount: fresh ? fresh.likeCount : 0,
    commentCount: fresh ? fresh.commentCount : 0,
    repostCount: fresh ? fresh.repostCount : 0,
  };
  emitToUser(recipient, "post:counts", counts);
  return counts;
}

/**
 * POST /api/posts/:id/like - idempotent, so a double tap cannot add a user
 * twice: $addToSet guards the list and $inc moves the counter with it.
 * A like that was not there yet notifies the author; your own post never does.
 */
const likePost = asyncHandler(async (req, res) => {
  const post = await requirePost(req.params.id);
  const viewerId = String(req.user._id);

  if (!post.likes.some((id) => String(id) === viewerId)) {
    await Post.updateOne(
      { _id: post._id },
      { $addToSet: { likes: req.user._id }, $inc: { likeCount: 1 } }
    );
    await notify({
      recipient: post.author,
      actor: req.user._id,
      type: "like",
      post: post._id,
      dedupe: true,
    });
  }

  const counts = await pushCounts(post._id, post.author);
  res.status(200).json({ liked: true, likeCount: counts.likeCount });
});

/**
 * DELETE /api/posts/:id/like - also idempotent; unliking twice is not an error.
 * The like notification is taken back with the like, so flipping the heart off
 * and on cannot leave a row, or a badge, behind.
 */
const unlikePost = asyncHandler(async (req, res) => {
  const post = await requirePost(req.params.id);
  const viewerId = String(req.user._id);

  if (post.likes.some((id) => String(id) === viewerId)) {
    await Post.updateOne(
      { _id: post._id, likeCount: { $gt: 0 } },
      { $pull: { likes: req.user._id }, $inc: { likeCount: -1 } }
    );
    await removeNotification({
      recipient: post.author,
      actor: req.user._id,
      type: "like",
      post: post._id,
    });
  }

  const counts = await pushCounts(post._id, post.author);
  res.status(200).json({ liked: false, likeCount: counts.likeCount });
});

/**
 * A repost is a Post document whose repostOf points at another post, which is
 * how the data model describes it: the feed renders it as the original with a
 * "Reposted by" line. Reposting a repost resolves to its original, so the graph
 * never nests.
 */
async function resolveOriginal(id) {
  const target = await Post.findById(id).select("_id repostOf author");
  if (!target) throw AppError.notFound("That post does not exist.");
  if (!target.repostOf) return target;

  const original = await Post.findById(target.repostOf).select("_id repostOf author");
  if (!original) throw AppError.notFound("That post does not exist.");
  return original.repostOf ? resolveOriginal(original._id) : original;
}

/**
 * POST /api/posts/:id/repost - optional content, 201 with the new post.
 *
 * One repost per person per post, because the button is a toggle: a repeat POST
 * answers 200 with the repost that already exists instead of stacking a second
 * one and inflating repostCount. The same call on the idempotent like routes.
 */
const repostPost = asyncHandler(async (req, res) => {
  const original = await resolveOriginal(req.params.id);
  const content = typeof req.body.content === "string" ? req.body.content.trim() : "";

  const existing = await Post.findOne({ author: req.user._id, repostOf: original._id });
  if (existing) {
    const reposted = new Set([String(original._id)]);
    const populated = await populatePost(Post.findById(existing._id));
    return res.status(200).json(serializePost(populated, { viewer: req.user, reposted }));
  }

  const created = await Post.create({
    author: req.user._id,
    content,
    images: [],
    repostOf: original._id,
  });

  await Post.updateOne({ _id: original._id }, { $inc: { repostCount: 1 } });
  await notify({
    recipient: original.author,
    actor: req.user._id,
    type: "repost",
    post: original._id,
    dedupe: true,
  });
  await pushCounts(original._id, original.author);

  const reposted = new Set([String(original._id)]);
  const populated = await populatePost(Post.findById(created._id));
  return res.status(201).json(serializePost(populated, { viewer: req.user, reposted }));
});

/**
 * DELETE /api/posts/:id/repost - always 204, whether or not a repost existed,
 * so the toggle is safe to fire twice. The id may be the original or the repost.
 */
const unrepostPost = asyncHandler(async (req, res) => {
  const target = await Post.findById(req.params.id).select("_id repostOf");
  if (!target) throw AppError.notFound("That post does not exist.");

  const originalId = target.repostOf || target._id;
  const original = await Post.findById(originalId).select("author");
  const repost = await Post.findOne({ author: req.user._id, repostOf: originalId });

  if (repost) {
    await repost.deleteOne();
    await Post.updateOne(
      { _id: originalId, repostCount: { $gt: 0 } },
      { $inc: { repostCount: -1 } }
    );
    await Promise.all([
      Notification.deleteMany({ post: repost._id }),
      removeNotification({
        recipient: original ? original.author : null,
        actor: req.user._id,
        type: "repost",
        post: originalId,
      }),
    ]);
    await pushCounts(originalId, original ? original.author : null);
  }

  res.status(204).end();
});

/**
 * POST /api/posts/:id/bookmark - bookmarks are private: an array on the user
 * document that never appears in anyone else's response. Idempotent.
 */
const bookmarkPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).select("_id");
  if (!post) throw AppError.notFound("That post does not exist.");

  await User.updateOne({ _id: req.user._id }, { $addToSet: { bookmarks: post._id } });
  res.status(200).json({ bookmarked: true });
});

/** DELETE /api/posts/:id/bookmark - also idempotent. */
const unbookmarkPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).select("_id");
  if (!post) throw AppError.notFound("That post does not exist.");

  await User.updateOne({ _id: req.user._id }, { $pull: { bookmarks: post._id } });
  res.status(200).json({ bookmarked: false });
});

/**
 * GET /api/posts/bookmarks - the viewer's saved posts, newest first.
 *
 * Paging is by the post's own _id, not by when it was saved, so the same cursor
 * rule every other list uses still applies. The saved order can therefore differ
 * from the order shown; that is the cost of not keeping a second, stampable list.
 */
const listBookmarks = asyncHandler(async (req, res) => {
  const ids = req.user.bookmarks || [];
  if (ids.length === 0) return res.status(200).json({ items: [], nextCursor: null });

  const limit = parseLimit(req.query.limit);
  const cursor = cursorFilter(req.query.cursor);

  // `$in` and `$lt` cannot share one _id object, so they travel in an $and.
  const filter = cursor._id ? { $and: [{ _id: { $in: ids } }, cursor] } : { _id: { $in: ids } };

  const docs = await populatePost(Post.find(filter).sort({ _id: -1 }).limit(limit + 1));
  const { items, nextCursor } = paginate(docs, limit);

  return res.status(200).json(await serializePosts(items, nextCursor, req.user));
});

module.exports = {
  createPost,
  getPost,
  listUserPosts,
  getFeed,
  getExplore,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  repostPost,
  unrepostPost,
  bookmarkPost,
  unbookmarkPost,
  listBookmarks,
};
