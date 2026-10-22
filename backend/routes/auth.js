"use strict";

const express = require("express");
const { me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, me);

module.exports = router;
