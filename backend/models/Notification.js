"use strict";

const mongoose = require("mongoose");

/** The five things that can wake someone up, per the data model table. */
const TYPES = ["like", "comment", "follow", "repost", "message"];

/**
 * A Notification is created inside the request that causes it, then pushed to
 * the recipient's Socket.IO room. There is no job queue in v1, so fan-out is
 * deliberately part of the write path rather than a background worker.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: TYPES, required: true },
    // A message notification has no post; a follow notification has no post either.
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Serves the notification list and the unread count from one index.
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
