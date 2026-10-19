"use strict";

const express = require("express");
const { getProfile, updateMe } = require("../controllers/userController");
const { updateMeRules } = require("../validators/user");
const validate = require("../middleware/validate");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { singleImage } = require("../middleware/upload");

const router = express.Router();

// /me is declared before /:username so it is never read as a handle.
router.patch("/me", requireAuth, singleImage, updateMeRules, validate, updateMe);

// Profiles are public (the frontend route table marks /[username] public), so
// the cookie is optional here. isFollowing is only true when a viewer is known.
router.get("/:username", optionalAuth, getProfile);

module.exports = router;
