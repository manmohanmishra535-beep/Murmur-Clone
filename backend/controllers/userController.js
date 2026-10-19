"use strict";

const User = require("../models/User");
const Post = require("../models/Post");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { serializeUser } = require("../utils/serialize");
const { uploadBuffer, destroyImage, FOLDERS } = require("../config/cloudinary");

/** GET /api/users/:username - public profile plus the viewer's relationship flags. */
const getProfile = asyncHandler(async (req, res) => {
  const username = String(req.params.username || "").toLowerCase();

  const user = await User.findOne({ username });
  if (!user) throw AppError.notFound("That account does not exist.");

  const viewerId = req.user ? String(req.user._id) : null;

  const isFollowing =
    req.user && req.user.following
      ? req.user.following.some((id) => String(id) === String(user._id))
      : false;

  const postCount = await Post.countDocuments({ author: user._id });

  res.status(200).json({
    user: serializeUser(user, {
      includeEmail: viewerId === String(user._id),
      isFollowing,
      counts: { postCount },
    }),
  });
});

/**
 * PATCH /api/users/me - displayName, bio and an optional avatar.
 * Text fields are validated by updateMeRules; the image is replaced on
 * Cloudinary and the old asset is deleted by publicId.
 */
const updateMe = asyncHandler(async (req, res) => {
  const user = req.user;

  if (typeof req.body.displayName === "string") user.displayName = req.body.displayName;
  if (typeof req.body.bio === "string") user.bio = req.body.bio;

  if (req.file) {
    const previousPublicId = user.profileImage && user.profileImage.publicId;

    const uploaded = await uploadBuffer(req.file.buffer, FOLDERS.avatars, {
      transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    });

    user.profileImage = { url: uploaded.secure_url, publicId: uploaded.public_id };
    await user.save();

    // Only remove the old asset once the new one is committed.
    if (previousPublicId && previousPublicId !== uploaded.public_id) {
      await destroyImage(previousPublicId);
    }
  } else {
    await user.save();
  }

  res.status(200).json({ user: serializeUser(user, { includeEmail: true }) });
});

module.exports = { getProfile, updateMe };
