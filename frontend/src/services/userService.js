import { api } from "./api";

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
};
