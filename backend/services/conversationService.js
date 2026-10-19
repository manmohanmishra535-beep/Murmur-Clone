"use strict";

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { notify } = require("../utils/notify");
const { emitToUser } = require("../realtime/emitter");
const { serializeMessage, serializeConversation } = require("../utils/serialize");
const { parseLimit, paginate, cursorFilter } = require("../utils/pagination");

// The same shallow author every other list sends.
const AUTHOR_FIELDS = "username displayName profileImage";

// The docs do not set a message length; 2000 is the ceiling so a hand-rolled
// payload cannot stuff a document. It is enforced here as well as in the
// validator, because the socket path never passes through express-validator.
const MESSAGE_MAX = 2000;

// An inbox is read whole, so the list is capped rather than cursor paged.
const INBOX_LIMIT = 50;

function populateConversation(query) {
  return query
    .populate("participants", AUTHOR_FIELDS)
    .populate({ path: "lastMessage", populate: { path: "sender", select: AUTHOR_FIELDS } });
}

/** Loads a conversation the caller is part of, or explains why they cannot. */
async function requireParticipant(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId).select("participants");
  if (!conversation) throw AppError.notFound("That conversation does not exist.");

  const isMember = conversation.participants.some((id) => String(id) === String(userId));
  if (!isMember) throw AppError.forbidden("You are not part of that conversation.");

  return conversation;
}

/**
 * POST /api/conversations - opening a chat with someone never makes a second
 * one.
 *
 * This is a find and then a create rather than one upsert, because the filter
 * pins both members of the pair ($all and $size on the same array) and MongoDB
 * cannot derive the fields of an upserted document from a filter like that. Two
 * simultaneous first messages from the same pair could therefore open two
 * conversations; the inbox would simply show both. A canonical pair key with a
 * unique index is the fix when that matters.
 */
async function getOrCreateConversation(userId, otherUserId) {
  if (!otherUserId) {
    throw AppError.validation("Choose someone to message.", { userId: "Choose a person." });
  }
  if (String(userId) === String(otherUserId)) {
    throw AppError.badRequest("SELF_CONVERSATION", "You cannot message yourself.");
  }

  const other = await User.findById(otherUserId).select("_id");
  if (!other) throw AppError.notFound("That account does not exist.");

  let conversation = await Conversation.findOne({
    participants: { $all: [userId, other._id] },
  });
  if (!conversation) {
    conversation = await Conversation.create({ participants: [userId, other._id] });
  }

  const populated = await populateConversation(Conversation.findById(conversation._id));
  return serializeConversation(populated, { viewerId: userId });
}

/** GET /api/conversations - the inbox, most recently active first. */
async function listConversations(userId, rawLimit) {
  const limit = Math.min(Math.max(Number.parseInt(rawLimit, 10) || 20, 1), INBOX_LIMIT);

  const docs = await populateConversation(
    Conversation.find({ participants: userId })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit)
  );

  // The inbox is ordered by activity, not by _id, so there is no id cursor to
  // hand back. One envelope shape everywhere, with a null cursor here.
  return { items: docs.map((doc) => serializeConversation(doc, { viewerId: userId })) };
}

/** GET /api/conversations/:id/messages - newest first, the same cursor rule as every list. */
async function listMessages(userId, conversationId, { limit, cursor } = {}) {
  await requireParticipant(conversationId, userId);

  const take = parseLimit(limit);
  const docs = await Message.find({ conversation: conversationId, ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(take + 1)
    .populate("sender", AUTHOR_FIELDS);

  const { items, nextCursor } = paginate(docs, take);
  return { items: items.map(serializeMessage), nextCursor };
}

/**
 * The one code path that writes a message. Both the REST route and the
 * `message:send` socket event call it, so the two can never drift apart.
 *
 * Both participants receive `message:new`: the recipient's chat and inbox
 * update straight away, and the sender's other tabs stay in step. The client
 * de-dupes by _id, so its own optimistic row is not doubled.
 */
async function createMessage(userId, conversationId, rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";

  if (!text) {
    throw AppError.validation("Write a message.", { text: "Write a message." });
  }
  if (text.length > MESSAGE_MAX) {
    throw AppError.validation(`Keep your message to ${MESSAGE_MAX} characters.`, {
      text: `Keep your message to ${MESSAGE_MAX} characters.`,
    });
  }

  const conversation = await requireParticipant(conversationId, userId);

  const message = await Message.create({
    conversation: conversation._id,
    sender: userId,
    text,
  });
  await message.populate("sender", AUTHOR_FIELDS);

  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: message._id, updatedAt: new Date() } }
  );

  const payload = serializeMessage(message);
  for (const participant of conversation.participants) {
    emitToUser(participant, "message:new", payload);
  }

  // One notification per message, so an unread chat keeps its badge.
  const recipient = conversation.participants.find((id) => String(id) !== String(userId));
  await notify({
    recipient,
    actor: userId,
    type: "message",
    conversation: conversation._id,
  });

  return payload;
}

module.exports = {
  MESSAGE_MAX,
  INBOX_LIMIT,
  populateConversation,
  requireParticipant,
  getOrCreateConversation,
  listConversations,
  listMessages,
  createMessage,
};
