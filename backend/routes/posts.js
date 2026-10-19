"use strict";

const express = require("express");
const {
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
} = require("../controllers/postController");
const { listComments, createComment } = require("../controllers/commentController");
const { createPostRules, updatePostRules, repostRules } = require("../validators/post");
const { createCommentRules } = require("../validators/comment");
const validate = require("../middleware/validate");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { postImages } = require("../middleware/upload");

const router = express.Router();

// Writing needs a session. Reading a single post and an author's timeline is
// public, because the frontend route table marks /post/[id] and /[username]
// public, so a shared link opens for a signed-out visitor. The viewer's own
// flags (likedByMe, repostedByMe, bookmarkedByMe) are only filled in when a
// cookie is present.

// multer runs before validate so the "text or an image" rule can see req.files.
router.post("/", requireAuth, postImages, createPostRules, validate, createPost);

// Every literal path is declared before /:id so it is never read as an ObjectId.
router.get("/feed", requireAuth, getFeed);
router.get("/explore", requireAuth, getExplore);
router.get("/bookmarks", requireAuth, listBookmarks);
router.get("/user/:username", optionalAuth, listUserPosts);
router.get("/:id", optionalAuth, getPost);

router.patch("/:id", requireAuth, updatePostRules, validate, updatePost);
router.delete("/:id", requireAuth, deletePost);

// Liking is idempotent on both verbs, so a double tap is never a 409.
router.post("/:id/like", requireAuth, likePost);
router.delete("/:id/like", requireAuth, unlikePost);

// Reposting is a toggle as well: a second POST answers 200 with the repost that
// already exists, and DELETE is always 204 so it is safe to fire twice.
router.post("/:id/repost", requireAuth, repostRules, validate, repostPost);
router.delete("/:id/repost", requireAuth, unrepostPost);

// Bookmarks are private to the signed-in user, so both verbs need a session.
router.post("/:id/bookmark", requireAuth, bookmarkPost);
router.delete("/:id/bookmark", requireAuth, unbookmarkPost);

// A comment thread hangs off the post it belongs to. Reading it is public, the
// same as the post itself, so a shared link shows the whole conversation.
router.get("/:id/comments", optionalAuth, listComments);
router.post("/:id/comments", requireAuth, createCommentRules, validate, createComment);

module.exports = router;
