"use strict";

const express = require("express");
const { connectionState } = require("../config/db");
const authRoutes = require("./auth");
const userRoutes = require("./users");
const postRoutes = require("./posts");
const commentRoutes = require("./comments");
const notificationRoutes = require("./notifications");
const conversationRoutes = require("./conversations");

const router = express.Router();

/** GET /api/health - used by uptime checks and the CI deploy health probe. */
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", db: connectionState() });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/posts", postRoutes);
router.use("/comments", commentRoutes);
router.use("/notifications", notificationRoutes);
router.use("/conversations", conversationRoutes);

module.exports = router;
