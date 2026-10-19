"use strict";

const Notification = require("../models/Notification");
const { emitToUser } = require("../realtime/emitter");
const { serializeNotification } = require("./serialize");

// The same shallow author every other list sends, so a row renders from one shape.
const AUTHOR_FIELDS = "username displayName profileImage";
const POST_FIELDS = "author content images likeCount commentCount repostCount createdAt";

/** A notification row needs its actor, and the post it happened on, with that post's author. */
function populateNotification(query) {
  return query.populate([
    { path: "actor", select: AUTHOR_FIELDS },
    {
      path: "post",
      select: POST_FIELDS,
      populate: { path: "author", select: AUTHOR_FIELDS },
    },
  ]);
}

/**
 * Store a notification, then push it to the recipient's room.
 *
 * Version 1 has no job queue, so this is part of the write path that caused it.
 * Notably it never rejects: a notification is a side effect, and a failure to
 * record one must not fail the like or the follow that triggered it.
 *
 * Actions on your own content never notify you, so a self-like is a no-op here.
 *
 * `dedupe` is for the toggling events. Liked and followed can be flipped off and
 * on again, and the row for them is removed on the way off (see
 * removeNotification), so this keeps a repeated flip from stacking up rows.
 */
async function notify({
  recipient,
  actor,
  type,
  post = null,
  conversation = null,
  dedupe = false,
}) {
  const recipientId = recipient ? String(recipient) : "";
  const actorId = actor ? String(actor) : "";
  if (!recipientId || !actorId || recipientId === actorId) return null;

  try {
    const filter = { recipient: recipientId, actor: actorId, type, post: post || null };
    if (dedupe && (await Notification.exists(filter))) return null;

    const doc = await Notification.create({ ...filter, conversation: conversation || null });
    await populateNotification(doc);

    emitToUser(recipientId, "notification:new", serializeNotification(doc));
    return doc;
  } catch (error) {
    console.error("[api] notification failed:", error.message);
    return null;
  }
}

/**
 * The other half of a toggle: unliking or unfollowing takes the row back, so
 * flipping a like on and off cannot leave a stale row behind, and the badge
 * count stays honest. The removal is pushed too, so an open screen drops it.
 */
async function removeNotification({ recipient, actor, type, post = null }) {
  const recipientId = recipient ? String(recipient) : "";
  const actorId = actor ? String(actor) : "";
  if (!recipientId || !actorId) return null;

  try {
    const doc = await Notification.findOneAndDelete({
      recipient: recipientId,
      actor: actorId,
      type,
      post: post || null,
    });
    // `read` travels with the removal so the client knows whether the badge
    // moves: a row that was already read was already counted out.
    if (doc) {
      emitToUser(recipientId, "notification:remove", {
        _id: String(doc._id),
        read: Boolean(doc.read),
      });
    }
    return doc;
  } catch (error) {
    console.error("[api] notification removal failed:", error.message);
    return null;
  }
}

module.exports = { notify, removeNotification, populateNotification, POST_FIELDS, AUTHOR_FIELDS };
