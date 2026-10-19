"use strict";

const Comment = require("../models/Comment");
const Post = require("../models/Post");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { assertOwner } = require("../middleware/auth");
const { serializeComment, paginated } = require("../utils/serialize");
const { notify } = require("../utils/notify");
const { emitToUser } = require("../realtime/emitter");
const { parseLimit, paginate, cursorFilter } = require("../utils/pagination");

// Only the fields a comment header renders; a thread must not drag whole profiles.
const AUTHOR_FIELDS = "username displayName profileImage";

/** A comment cannot be written under, or read from, a post that does not exist. */
async function requirePost(id) {
  const post = await Post.findById(id).select("_id author");
  if (!post) throw AppError.notFound("That post does not exist.");
  return post;
}

/** Push the authoritative counters to the author, so their copy stays live. */
async function pushCounts(postId, recipient) {
  const fresh = await Post.findById(postId).select("likeCount commentCount repostCount");
  emitToUser(recipient, "post:counts", {
    postId: String(postId),
    likeCount: fresh ? fresh.likeCount : 0,
    commentCount: fresh ? fresh.commentCount : 0,
    repostCount: fresh ? fresh.repostCount : 0,
  });
}

/** GET /api/posts/:id/comments - newest first, cursor paginated. */
const listComments = asyncHandler(async (req, res) => {
  await requirePost(req.params.id);

  const limit = parseLimit(req.query.limit);
  const docs = await Comment.find({ post: req.params.id, ...cursorFilter(req.query.cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", AUTHOR_FIELDS);

  const { items, nextCursor } = paginate(docs, limit);
  res.status(200).json(paginated(items, nextCursor, serializeComment));
});

/**
 * POST /api/posts/:id/comments - creates the reply and moves the counter.
 * commentCount is denormalised, so it is incremented in the same request that
 * adds the document; a second request can never double-count.
 */
const createComment = asyncHandler(async (req, res) => {
  const post = await requirePost(req.params.id);

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    content: req.body.content.trim(),
  });
  await comment.populate("author", AUTHOR_FIELDS);

  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

  await notify({
    recipient: post.author,
    actor: req.user._id,
    type: "comment",
    post: post._id,
  });
  await pushCounts(post._id, post.author);

  res.status(201).json(serializeComment(comment));
});

/**
 * DELETE /api/comments/:id - the comment's author only.
 * The `$gt: 0` guard keeps a counter that already reads zero from going negative
 * if a document is ever removed twice.
 */
const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  assertOwner(comment, req.user._id, "comment");

  await comment.deleteOne();
  await Post.updateOne(
    { _id: comment.post, commentCount: { $gt: 0 } },
    { $inc: { commentCount: -1 } }
  );

  const post = await Post.findById(comment.post).select("author");
  if (post) await pushCounts(post._id, post.author);

  res.status(204).end();
});

module.exports = { listComments, createComment, deleteComment };
