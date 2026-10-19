"use strict";

const express = require("express");
const {
  getProfile,
  updateMe,
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
  searchUsers,
  suggestedUsers,
} = require("../controllers/userController");
const { updateMeRules } = require("../validators/user");
const validate = require("../middleware/validate");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { singleImage } = require("../middleware/upload");

const router = express.Router();

// /me is declared before /:username so it is never read as a handle.
router.patch("/me", requireAuth, singleImage, updateMeRules, validate, updateMe);

// Search and suggestions are fixed words a handle could look like, so they come
// before /:username too, and both need a session (they carry isFollowing).
router.get("/search", requireAuth, searchUsers);
router.get("/suggested", requireAuth, suggestedUsers);

// The follow graph. Writing needs a session; a follower list is public, the
// same as the profile it belongs to, with isFollowing filled in when a cookie
// is present so each row can render its follow button.
router.post("/:id/follow", requireAuth, followUser);
router.delete("/:id/follow", requireAuth, unfollowUser);
router.get("/:id/followers", optionalAuth, listFollowers);
router.get("/:id/following", optionalAuth, listFollowing);

// Profiles are public (the frontend route table marks /[username] public), so
// the cookie is optional here. isFollowing is only true when a viewer is known.
router.get("/:username", optionalAuth, getProfile);

module.exports = router;
