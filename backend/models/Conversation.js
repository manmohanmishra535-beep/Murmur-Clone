"use strict";

const mongoose = require("mongoose");

/**
 * Two participants in v1, per the data model table. The conversation carries a
 * denormalised lastMessage so the inbox renders without loading a thread, and
 * updatedAt is what orders it.
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  },
  { timestamps: true }
);

// Inbox ordering: the conversations a user is in, most recently active first.
conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
