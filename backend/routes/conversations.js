"use strict";

const express = require("express");
const {
  getConversations,
  startConversation,
  getMessages,
  postMessage,
} = require("../controllers/messageController");
const { createConversationRules, createMessageRules } = require("../validators/message");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// A chat is between the signed-in user and someone else, never public.
router.use(requireAuth);

router.get("/", getConversations);
router.post("/", createConversationRules, validate, startConversation);

router.get("/:id/messages", getMessages);
router.post("/:id/messages", createMessageRules, validate, postMessage);

module.exports = router;
