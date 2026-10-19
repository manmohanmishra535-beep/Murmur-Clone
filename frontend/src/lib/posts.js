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
