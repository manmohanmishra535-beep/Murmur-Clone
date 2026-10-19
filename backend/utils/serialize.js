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

function serializeImage(image) {
  const raw = image || {};
  return { url: raw.url || "", publicId: raw.publicId || "" };
}

/**
 * The author of a post travels as four fields rather than a whole profile,
 * so a 20-post feed does not drag 20 bios and follower lists across the wire.
 */
function serializeAuthor(author) {
  const doc = author && typeof author === "object" ? author : null;
  if (!doc || !doc.username) {
    return { _id: doc ? String(doc) : "", username: "", displayName: "", profileImage: serializeImage() };
  }
  return {
    _id: String(doc._id),
    username: doc.username,
    displayName: doc.displayName || doc.username,
    profileImage: serializeImage(doc.profileImage),
  };
}

/**
 * One place that decides what a post looks like over the wire.
 * The like list stays behind; likedByMe, repostedByMe and bookmarkedByMe are
 * computed from the viewer so the client can render button states with no
 * extra round trips (see the API reference's create-post example).
 */
function serializePost(post, options = {}) {
  const { viewer = null } = options;
  if (!post) return null;

  const doc = typeof post.toObject === "function" ? post.toObject() : post;
  const viewerId = viewer ? String(viewer._id) : null;

  const likes = Array.isArray(doc.likes) ? doc.likes : [];
  const bookmarks = viewer && Array.isArray(viewer.bookmarks) ? viewer.bookmarks : [];

  // A populated repostOf arrives as a document; an unpopulated one as an id.
  const repostOf =
    doc.repostOf && typeof doc.repostOf === "object" && doc.repostOf.author
      ? serializePost(doc.repostOf, { viewer })
      : null;

  return {
    _id: String(doc._id),
    author: serializeAuthor(doc.author),
    content: doc.content || "",
    images: Array.isArray(doc.images) ? doc.images.map(serializeImage) : [],
    likeCount: doc.likeCount || 0,
    commentCount: doc.commentCount || 0,
    repostCount: doc.repostCount || 0,
    repostOf,
    editedAt: doc.editedAt || null,
    createdAt: doc.createdAt,
    likedByMe: viewerId ? likes.some((id) => String(id) === viewerId) : false,
    // Reposts arrive in Phase 4; the flag is part of the shape already so the
    // client contract does not change when it does.
    repostedByMe: false,
    bookmarkedByMe: viewerId
      ? bookmarks.some((id) => String(id) === String(doc._id))
      : false,
  };
}

/** Every list endpoint answers with the same envelope. */
function paginated(items, nextCursor, serialize = (item) => item) {
  return { items: items.map(serialize), nextCursor };
}

module.exports = { serializeUser, serializeAuthor, serializePost, serializeImage, paginated };
