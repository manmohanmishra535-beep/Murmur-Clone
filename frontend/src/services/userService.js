import { api } from "./api";

export const USER_PAGE_SIZE = 20;

function page({ cursor, limit }) {
  return { params: { limit, ...(cursor ? { cursor } : {}) } };
}

export const userService = {
  async getProfile(username) {
    const { data } = await api.get(`/users/${encodeURIComponent(username)}`);
    return data.user;
  },

  /**
   * PATCH /api/users/me accepts multipart so the avatar travels with the text.
   * Axios sets the boundary itself when given FormData.
   */
  async updateMe({ displayName, bio, imageFile }) {
    const form = new FormData();
    if (displayName !== undefined) form.append("displayName", displayName);
    if (bio !== undefined) form.append("bio", bio);
    if (imageFile) form.append("image", imageFile);

    const { data } = await api.patch("/users/me", form);
    return data.user;
  },

  /**
   * Follow and unfollow are both idempotent and answer { following: boolean },
   * so the client never has to reason about a 409 or a double tap.
   */
  async follow(id) {
    const { data } = await api.post(`/users/${encodeURIComponent(id)}/follow`);
    return data.following;
  },

  async unfollow(id) {
    const { data } = await api.delete(`/users/${encodeURIComponent(id)}/follow`);
    return data.following;
  },

  /** A user list, each row carrying the viewer's own isFollowing flag. */
  async followers(id, { cursor, limit = USER_PAGE_SIZE } = {}) {
    const { data } = await api.get(
      `/users/${encodeURIComponent(id)}/followers`,
      page({ cursor, limit })
    );
    return data;
  },

  async following(id, { cursor, limit = USER_PAGE_SIZE } = {}) {
    const { data } = await api.get(
      `/users/${encodeURIComponent(id)}/following`,
      page({ cursor, limit })
    );
    return data;
  },
};
