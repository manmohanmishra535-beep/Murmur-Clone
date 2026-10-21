"use strict";

const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  { url: String, publicId: String },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // Clerk owns identity: sign-up, sign-in, passwords and sessions all live
    // there. This row is the app's public profile and is linked by the id in
    // the session token. The sparse index lets rows created before Clerk was
    // introduced be adopted by email on first sign-in.
    clerkId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    username: {
      type: String,
      required: [true, "Pick a username."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]{3,15}$/, "Use 3 to 15 letters, numbers or underscores."],
    },
    email: {
      type: String,
      required: [true, "Enter your email."],
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, trim: true, maxlength: 50 },
    profileImage: { type: imageSchema, default: () => ({}) },
    bio: { type: String, maxlength: 160, default: "" },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  },
  { timestamps: true }
);

// Serves /api/users/search (Phase 4) as an as-you-type prefix fallback.
userSchema.index({ username: "text", displayName: "text" });

/** Never leak the private bookmark list, even if someone forgets a projection. */
userSchema.set("toJSON", {
  versionKey: false,
  transform(_doc, ret) {
    delete ret.bookmarks;
    delete ret.email;
    delete ret.clerkId;
    return ret;
  },
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
