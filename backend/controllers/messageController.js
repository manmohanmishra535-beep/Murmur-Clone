"use strict";

const asyncHandler = require("../utils/asyncHandler");
const {
  getOrCreateConversation,
  listConversations,
  listMessages,
  createMessage,
} = require("../services/conversationService");

/** GET /api/conversations - the inbox, most recently active first. */
const getConversations = asyncHandler(async (req, res) => {
  const { items } = await listConversations(req.user._id, req.query.limit);
  res.status(200).json({ items, nextCursor: null });
});

/** POST /api/conversations - the existing conversation with that user, or a new one. */
const startConversation = asyncHandler(async (req, res) => {
  const conversation = await getOrCreateConversation(req.user._id, req.body.userId);
  res.status(200).json(conversation);
});

/** GET /api/conversations/:id/messages - newest first, cursor paginated. */
const getMessages = asyncHandler(async (req, res) => {
  const page = await listMessages(req.user._id, req.params.id, {
    limit: req.query.limit,
    cursor: req.query.cursor,
  });
  res.status(200).json(page);
});

/**
 * POST /api/conversations/:id/messages - writes the message and pushes it to
 * both participants over the socket, from the one service both paths share.
 */
const postMessage = asyncHandler(async (req, res) => {
  const message = await createMessage(req.user._id, req.params.id, req.body.text);
  res.status(201).json(message);
});

module.exports = { getConversations, startConversation, getMessages, postMessage };
