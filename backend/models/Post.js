"use strict";

const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  { url: String, publicId: String },
  { _id: false }
);

/**
 * A Post is up to 280 characters of text, up to 4 images, or both.
 * Likes live in an array of ObjectIds and a matching counter is kept beside it
 * so a feed never has to count the array. repostOf points at another post; a
 * plain repost carries no content of its own.
 */
const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "A post needs an author."],
      index: true,
    },
    content: { type: String, maxlength: 280, trim: true, default: "" },
    images: { type: [imageSchema], default: [] },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    repostCount: { type: Number, default: 0, min: 0 },
    repostOf: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Serves a profile timeline and the home feed: filter by author, newest first.
postSchema.index({ author: 1, createdAt: -1 });
// Serves the explore timeline and the cursor for infinite scroll.
postSchema.index({ createdAt: -1 });

/** Never leak the like list; likedByMe is computed per request instead. */
postSchema.set("toJSON", {
  versionKey: false,
  transform(_doc, ret) {
    delete ret.likes;
    return ret;
  },
});

module.exports = mongoose.models.Post || mongoose.model("Post", postSchema);
