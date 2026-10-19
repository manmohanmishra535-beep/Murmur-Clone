"use strict";

const express = require("express");
const { deleteComment } = require("../controllers/commentController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Listing and creating a comment hang off the post they belong to, so they live
// in routes/posts.js (/api/posts/:id/comments). Only the flat delete lives here.
router.delete("/:id", requireAuth, deleteComment);

module.exports = router;
