import { api } from "./api";

export const MESSAGE_PAGE_SIZE = 20;
export const INBOX_LIMIT = 50;

function encode(id) {
  return encodeURIComponent(id);
}

/**
 * Conversations and messages. Sending over REST and sending over the socket
 * reach the same service on the server, so both store the message identically;
 * the socket is only the live push.
 */
export const messageService = {
  /** GET /api/conversations - the inbox, most recently active first. */
  async conversations({ limit = INBOX_LIMIT } = {}) {
    const { data } = await api.get("/conversations", { params: { limit } });
    return data;
  },

  /** POST /api/conversations - the existing conversation with that user, or a new one. */
  async start(userId) {
    const { data } = await api.post("/conversations", { userId });
    return data;
  },

  /** GET /api/conversations/:id/messages - newest first, cursor paginated. */
  async messages(conversationId, { cursor, limit = MESSAGE_PAGE_SIZE } = {}) {
    const { data } = await api.get(
      `/conversations/${encode(conversationId)}/messages`,
      { params: { limit, ...(cursor ? { cursor } : {}) } }
    );
    return data;
  },

  async send(conversationId, text) {
    const { data } = await api.post(`/conversations/${encode(conversationId)}/messages`, {
      text,
    });
    return data;
  },
};
