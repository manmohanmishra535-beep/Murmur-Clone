"use strict";

const express = require("express");
const {
  createPost,
  getPost,
  listUserPosts,
  getFeed,
  updatePost,
  deletePost,
} = require("../controllers/postController");
const { createPostRules, updatePostRules } = require("../validators/post");
const validate = require("../middleware/validate");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { postImages } = require("../middleware/upload");

const router = express.Router();

// Writing needs a session. Reading a single post and an author's timeline is
// public, because the frontend route table marks /post/[id] and /[username]
// public, so a shared link opens for a signed-out visitor. The viewer's own
// flags (likedByMe, bookmarkedByMe) are only filled in when a cookie is present.

// multer runs before validate so the "text or an image" rule can see req.files.
router.post("/", requireAuth, postImages, createPostRules, validate, createPost);

// /feed is declared before /:id so it is never read as an ObjectId.
router.get("/feed", requireAuth, getFeed);
router.get("/user/:username", optionalAuth, listUserPosts);
router.get("/:id", optionalAuth, getPost);

router.patch("/:id", requireAuth, updatePostRules, validate, updatePost);
router.delete("/:id", requireAuth, deletePost);

module.exports = router;
