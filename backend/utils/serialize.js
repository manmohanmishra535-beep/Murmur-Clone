"use strict";

/**
 * One place that decides what a user looks like over the wire.
 * The password hash, the private bookmark list and the follower arrays never
 * leave the API; counts go out instead, plus the viewer's own relationship flags.
 */
function serializeUser(user, options = {}) {
  const { includeEmail = false, isFollowing = false, counts = {} } = options;
  if (!user) return null;

  const doc = typeof user.toObject === "function" ? user.toObject() : user;
  const profileImage = doc.profileImage || {};

  const body = {
    _id: String(doc._id),
    username: doc.username,
    displayName: doc.displayName || doc.username,
    bio: doc.bio || "",
    profileImage: { url: profileImage.url || "", publicId: profileImage.publicId || "" },
    followerCount: Array.isArray(doc.followers) ? doc.followers.length : 0,
    followingCount: Array.isArray(doc.following) ? doc.following.length : 0,
    postCount: counts.postCount ?? 0,
    isFollowing,
    createdAt: doc.createdAt,
  };

  if (includeEmail) body.email = doc.email;

  return body;
}

module.exports = { serializeUser };
