"use strict";

const mongoose = require("mongoose");

/**
 * A Comment is up to 280 characters of text on a post. Comments live in their
 * own collection rather than inside the post, so a post with thousands of
 * replies never grows the post document; Post.commentCount is kept beside it
 * so a feed never counts an array.
 */
const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "A comment needs a post."],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A comment needs an author."],
    },
    content: {
      type: String,
      required: [true, "Write something to reply."],
      trim: true,
      maxlength: 280,
    },
  },
  { timestamps: true }
);

// Serves GET /api/posts/:id/comments, which pages a thread newest first.
commentSchema.index({ post: 1, createdAt: -1 });

module.exports = mongoose.models.Comment || mongoose.model("Comment", commentSchema);
