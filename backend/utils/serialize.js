"use strict";

/**
 * One place that decides what a user looks like over the wire.
 * The private bookmark list, the email (unless the viewer is the owner) and the
 * follower arrays never leave the API; counts go out instead, plus the viewer's
 * own relationship flags.
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
 *
 * `reposted` is the set of post ids the viewer has reposted. There is no
 * reposts array on Post (the docs' schema has only repostCount), so the caller
 * resolves it in one query per page rather than one per post.
 */
function serializePost(post, options = {}) {
  const { viewer = null, reposted = null } = options;
  if (!post) return null;

  const doc = typeof post.toObject === "function" ? post.toObject() : post;
  const viewerId = viewer ? String(viewer._id) : null;

  const likes = Array.isArray(doc.likes) ? doc.likes : [];
  const bookmarks = viewer && Array.isArray(viewer.bookmarks) ? viewer.bookmarks : [];

  // A populated repostOf arrives as a document; an unpopulated one as an id.
  const repostOf =
    doc.repostOf && typeof doc.repostOf === "object" && doc.repostOf.author
      ? serializePost(doc.repostOf, { viewer, reposted })
      : null;

  const id = String(doc._id);
  const repostedIds = reposted ? Array.from(reposted, String) : [];

  // "You have this reposted": true of the original, and true of a repost that
  // carries it, so the button reads the same whichever one the feed showed.
  const repostedByMe =
    repostedIds.includes(id) || (repostOf ? repostedIds.includes(repostOf._id) : false);

  return {
    _id: id,
    author: serializeAuthor(doc.author),
    content: doc.content || "",
    images: Array.isArray(doc.images) ? doc.images.map(serializeImage) : [],
    likeCount: doc.likeCount || 0,
    commentCount: doc.commentCount || 0,
    repostCount: doc.repostCount || 0,
    repostOf,
    editedAt: doc.editedAt || null,
    createdAt: doc.createdAt,
    likedByMe: viewerId ? likes.some((value) => String(value) === viewerId) : false,
    repostedByMe,
    bookmarkedByMe: viewerId ? bookmarks.some((value) => String(value) === id) : false,
  };
}

/** Every list endpoint answers with the same envelope. */
function paginated(items, nextCursor, serialize = (item) => item) {
  return { items: items.map(serialize), nextCursor };
}

/**
 * One place that decides what a comment looks like over the wire.
 * Shallow by design: a thread of 20 replies carries 20 authors, not 20 posts.
 */
function serializeComment(comment) {
  const doc = typeof comment.toObject === "function" ? comment.toObject() : comment;
  const post = doc.post && doc.post._id ? doc.post._id : doc.post;

  return {
    _id: String(doc._id),
    post: post ? String(post) : "",
    author: serializeAuthor(doc.author),
    content: doc.content || "",
    createdAt: doc.createdAt,
  };
}

/**
 * A notification row: who did it, what they did, and the post it happened on.
 * The post travels in the same shallow shape a feed uses, so the row can show
 * a preview and link straight to it.
 */
function serializeNotification(notification, options = {}) {
  const { viewer = null } = options;
  if (!notification) return null;

  const doc =
    typeof notification.toObject === "function" ? notification.toObject() : notification;
  const post =
    doc.post && typeof doc.post === "object" && doc.post._id
      ? serializePost(doc.post, { viewer })
      : null;

  return {
    _id: String(doc._id),
    type: doc.type,
    read: Boolean(doc.read),
    actor: serializeAuthor(doc.actor),
    post,
    conversation: doc.conversation ? String(doc.conversation) : null,
    createdAt: doc.createdAt,
  };
}

/** A chat message: the sender travels shallow, like every other author. */
function serializeMessage(message) {
  const doc = typeof message.toObject === "function" ? message.toObject() : message;
  const conversation =
    doc.conversation && doc.conversation._id ? doc.conversation._id : doc.conversation;

  return {
    _id: String(doc._id),
    conversation: conversation ? String(conversation) : "",
    sender: serializeAuthor(doc.sender),
    text: doc.text || "",
    readAt: doc.readAt || null,
    createdAt: doc.createdAt,
  };
}

/**
 * An inbox row. `other` is the participant who is not the viewer, resolved here
 * so the client never has to filter the participants array itself.
 */
function serializeConversation(conversation, options = {}) {
  const { viewerId = null } = options;
  if (!conversation) return null;

  const doc =
    typeof conversation.toObject === "function" ? conversation.toObject() : conversation;
  const participants = Array.isArray(doc.participants) ? doc.participants : [];
  const other = participants.find((person) => String(person && person._id) !== String(viewerId));

  return {
    _id: String(doc._id),
    participants: participants.map((person) => serializeAuthor(person)),
    other: other ? serializeAuthor(other) : null,
    lastMessage:
      doc.lastMessage && doc.lastMessage._id ? serializeMessage(doc.lastMessage) : null,
    updatedAt: doc.updatedAt,
  };
}

module.exports = {
  serializeUser,
  serializeAuthor,
  serializePost,
  serializeComment,
  serializeNotification,
  serializeMessage,
  serializeConversation,
  serializeImage,
  paginated,
};
