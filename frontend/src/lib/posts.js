/** Pure helpers for post lists, kept out of the hooks so they can be tested. */

/** TanStack Query keeps pages as [[items, items], [items]]; the UI wants one list. */
export function flattenPages(data) {
  if (!data || !Array.isArray(data.pages)) return [];
  return data.pages.flatMap((page) => (page && Array.isArray(page.items) ? page.items : []));
}

/** True when the post belongs to the viewer, so owner actions can be shown. */
export function isOwnPost(post, viewerId) {
  if (!post || !viewerId) return false;
  const authorId = post.author && post.author._id ? post.author._id : post.author;
  return Boolean(authorId) && String(authorId) === String(viewerId);
}

/** Removes one post from every cached page without refetching. */
export function withoutPost(data, postId) {
  if (!data || !Array.isArray(data.pages)) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: (page.items || []).filter((post) => post._id !== postId),
    })),
  };
}

/**
 * The post with a like or an unlike applied.
 *
 * The write goes through the cache rather than component state, so every view
 * of the same post agrees. Applying the state the post already has is a no-op
 * instead of a double count, which keeps an optimistic update and the server's
 * confirm from fighting; the counter never reads below zero.
 */
export function withLike(post, liked) {
  const next = Boolean(liked);
  if (Boolean(post.likedByMe) === next) {
    return { ...post, likeCount: Math.max(0, post.likeCount || 0) };
  }
  return {
    ...post,
    likedByMe: next,
    likeCount: Math.max(0, (post.likeCount || 0) + (next ? 1 : -1)),
  };
}

/** The post with its reply count moved by one, never below zero. */
export function withCommentCount(post, delta) {
  return { ...post, commentCount: Math.max(0, (post.commentCount || 0) + delta) };
}

/** Removes one reply from every cached comment page. */
export function withoutComment(data, commentId) {
  if (!data || !Array.isArray(data.pages)) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: (page.items || []).filter((comment) => comment._id !== commentId),
    })),
  };
}

/** The user row with the viewer's follow state and count moved together. */
export function withFollow(user, following) {
  const next = Boolean(following);
  if (Boolean(user.isFollowing) === next) return user;
  return {
    ...user,
    isFollowing: next,
    followerCount: Math.max(0, (user.followerCount || 0) + (next ? 1 : -1)),
  };
}

/** True when the viewer may follow this account (never yourself, never signed out). */
export function canFollow(user, viewerId) {
  if (!user || !viewerId) return false;
  return String(user._id) !== String(viewerId);
}
