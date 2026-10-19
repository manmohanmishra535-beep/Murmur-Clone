import { api } from "./api";

export const POST_PAGE_SIZE = 20;

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
    const { data } = await api.get(`/posts/${encodeURIComponent(id)}`);
    return data;
  },

  /** PATCH edits the text only; images are fixed when the post is created. */
  async update(id, { content }) {
    const { data } = await api.patch(`/posts/${encodeURIComponent(id)}`, { content });
    return data;
  },

  async remove(id) {
    await api.delete(`/posts/${encodeURIComponent(id)}`);
  },

  async feed({ cursor, limit = POST_PAGE_SIZE } = {}) {
    const { data } = await api.get("/posts/feed", {
      params: { limit, ...(cursor ? { cursor } : {}) },
    });
    return data;
  },

  async byUser({ username, cursor, limit = POST_PAGE_SIZE } = {}) {
    const { data } = await api.get(`/posts/user/${encodeURIComponent(username)}`, {
      params: { limit, ...(cursor ? { cursor } : {}) },
    });
    return data;
  },
};
