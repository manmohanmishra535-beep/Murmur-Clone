import { api } from "./api";

export const POST_PAGE_SIZE = 20;
export const COMMENT_PAGE_SIZE = 20;

function encode(id) {
  return encodeURIComponent(id);
}

/** The cursor params every list endpoint takes, with nothing sent when empty. */
function page({ cursor, limit }) {
  return { params: { limit, ...(cursor ? { cursor } : {}) } };
}

/**
 * The posts resource. Every call goes through the shared Axios instance, so
 * the httpOnly session cookie travels with it automatically.
 *
 * Single posts come back as the post itself and lists as { items, nextCursor },
 * which is the shape the engineering docs' API reference documents.
 */
export const postService = {
  /** POST /api/posts - multipart so text and up to 4 images travel together. */
  async create({ content, images = [] }) {
    const form = new FormData();
    form.append("content", content || "");
    for (const file of images) form.append("images", file);

    const { data } = await api.post("/posts", form);
    return data;
  },

  async get(id) {
    const { data } = await api.get(`/posts/${encode(id)}`);
    return data;
  },

  /** PATCH edits the text only; images are fixed when the post is created. */
  async update(id, { content }) {
    const { data } = await api.patch(`/posts/${encode(id)}`, { content });
    return data;
  },

  async remove(id) {
    await api.delete(`/posts/${encode(id)}`);
  },

  async feed({ cursor, limit = POST_PAGE_SIZE } = {}) {
    const { data } = await api.get("/posts/feed", page({ cursor, limit }));
    return data;
  },

  async explore({ cursor, limit = POST_PAGE_SIZE } = {}) {
    const { data } = await api.get("/posts/explore", page({ cursor, limit }));
    return data;
  },

  async byUser({ username, cursor, limit = POST_PAGE_SIZE } = {}) {
    const { data } = await api.get(`/posts/user/${encode(username)}`, page({ cursor, limit }));
    return data;
  },

  /** POST or DELETE /like. Both are idempotent and answer { liked, likeCount }. */
  async like(id) {
    const { data } = await api.post(`/posts/${encode(id)}/like`);
    return data;
  },

  async unlike(id) {
    const { data } = await api.delete(`/posts/${encode(id)}/like`);
    return data;
  },

  /** GET /api/posts/:id/comments - the thread, newest first. */
  async comments(id, { cursor, limit = COMMENT_PAGE_SIZE } = {}) {
    const { data } = await api.get(`/posts/${encode(id)}/comments`, page({ cursor, limit }));
    return data;
  },

  /** POST /api/posts/:id/comments - a reply is plain text up to 280 characters. */
  async addComment(id, content) {
    const { data } = await api.post(`/posts/${encode(id)}/comments`, { content });
    return data;
  },

  async removeComment(commentId) {
    await api.delete(`/comments/${encode(commentId)}`);
  },

  /**
   * POST /api/posts/:id/repost - 201 with the new repost, or 200 with the one
   * that already exists, so the toggle is safe to fire twice. The body carries
   * the original in repostOf, counters and all.
   */
  async repost(id, content = "") {
    const { data } = await api.post(`/posts/${encode(id)}/repost`, { content });
    return data;
  },

  async unrepost(id) {
    await api.delete(`/posts/${encode(id)}/repost`);
  },

  /** POST or DELETE /bookmark. Bookmarks answer { bookmarked: boolean }. */
  async bookmark(id) {
    const { data } = await api.post(`/posts/${encode(id)}/bookmark`);
    return data;
  },

  async unbookmark(id) {
    const { data } = await api.delete(`/posts/${encode(id)}/bookmark`);
    return data;
  },

  /** GET /api/posts/bookmarks - the viewer's own saved posts, newest first. */
  async bookmarks({ cursor, limit = POST_PAGE_SIZE } = {}) {
    const { data } = await api.get("/posts/bookmarks", page({ cursor, limit }));
    return data;
  },
};
