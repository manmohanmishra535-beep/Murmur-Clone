"use strict";

const mongoose = require("mongoose");

/**
 * A Message inside a conversation. Messages are their own collection rather
 * than an array on the conversation, so a long chat never grows one document,
 * and the { conversation: 1, createdAt: -1 } index serves the history read.
 *
 * The docs do not set a length; 2000 characters is the ceiling here so a
 * hand-rolled payload cannot stuff a document.
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model("Message", messageSchema);
