import { api } from "./api";

export const NOTIFICATION_PAGE_SIZE = 20;

function page({ cursor, limit }) {
  return { params: { limit, ...(cursor ? { cursor } : {}) } };
}

/**
 * Notifications belong to the signed-in user, so every call needs the session
 * cookie and there is nothing to pass but pagination.
 */
export const notificationService = {
  async list({ cursor, limit = NOTIFICATION_PAGE_SIZE } = {}) {
    const { data } = await api.get("/notifications", page({ cursor, limit }));
    return data;
  },

  async unreadCount() {
    const { data } = await api.get("/notifications/unread-count");
    return data.count;
  },

  /** Opening the notifications screen clears the badge. */
  async markAllRead() {
    await api.patch("/notifications/read");
  },
};
