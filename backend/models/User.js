"use strict";

const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  { url: String, publicId: String },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
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
    // select: false keeps the hash out of every query unless it is asked for,
    // so it can never be returned by accident.
    password: {
      type: String,
      required: [true, "Choose a password."],
      minlength: 8,
      select: false,
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

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  // Cost 12 per the security checklist. bcryptjs is a drop-in for bcrypt with
  // the same $2a$ format, chosen so npm install needs no native build step.
  const bcrypt = require("bcryptjs");
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) {
    throw new Error("comparePassword requires the document to be fetched with +password.");
  }
  const bcrypt = require("bcryptjs");
  return bcrypt.compare(candidate, this.password);
};

/** Never leak the hash or the private bookmark list, even if someone forgets a projection. */
userSchema.set("toJSON", {
  versionKey: false,
  transform(_doc, ret) {
    delete ret.password;
    delete ret.bookmarks;
    delete ret.email;
    return ret;
  },
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
