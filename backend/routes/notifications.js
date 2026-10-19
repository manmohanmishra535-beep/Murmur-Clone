"use strict";

const express = require("express");
const { listNotifications, unreadCount, markAllRead } = require("../controllers/notificationController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Everything here belongs to the signed-in user, so the whole router is guarded.
router.use(requireAuth);

router.get("/", listNotifications);

// Both literals are declared before anything that could read them as an id.
router.get("/unread-count", unreadCount);
router.patch("/read", markAllRead);

module.exports = router;
