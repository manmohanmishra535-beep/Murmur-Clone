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
const { requireAuth } = require("../middleware/auth");
const { postImages } = require("../middleware/upload");

const router = express.Router();

// Every posts route needs a session (the API reference marks them all auth'd).
router.use(requireAuth);

// multer runs before validate so the "text or an image" rule can see req.files.
router.post("/", postImages, createPostRules, validate, createPost);

// /feed is declared before /:id so it is never read as an ObjectId.
router.get("/feed", getFeed);
router.get("/user/:username", listUserPosts);
router.get("/:id", getPost);

router.patch("/:id", updatePostRules, validate, updatePost);
router.delete("/:id", deletePost);

module.exports = router;
