/**
 * Pure helpers for the inbox and the chat window, kept out of the hooks so they
 * can be tested without a browser or a live socket.
 */

/** The API's message ceiling. Mirrored here so the composer can refuse early. */
export const MESSAGE_MAX = 2000;

/** True when two rows are the same message, whichever way it arrived. */
function isSame(a, b) {
  return Boolean(a && b && a._id === b._id);
}

/**
 * Adds a message to its thread, once.
 *
 * Message pages arrive newest first, so a new row belongs at the front of the
 * first page. The socket echoes your own message back to you and the REST
 * response carries it too, so the same message can arrive twice; the id check
 * is what keeps it from being drawn twice.
 */
export function appendMessage(data, message) {
  if (!message) return data;
  if (!data || !Array.isArray(data.pages)) return data;

  const already = data.pages.some((page) =>
    (page.items || []).some((item) => isSame(item, message))
  );
  if (already) return data;

  if (data.pages.length === 0) {
    return { ...data, pages: [{ items: [message], nextCursor: null }] };
  }

  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [{ ...first, items: [message, ...(first.items || [])] }, ...rest],
  };
}

/** The thread in reading order: oldest first, because that is how a chat reads. */
export function messagesInOrder(data) {
  if (!data || !Array.isArray(data.pages)) return [];
  return data.pages
    .flatMap((page) => (page && Array.isArray(page.items) ? page.items : []))
    .slice()
    .reverse();
}

/**
 * The inbox with a conversation's preview moved to the top.
 *
 * The API orders the inbox by last activity, so a push has to do the same:
 * either the conversation is already in the list and moves up, or it is new and
 * joins the front. Only the preview changes, which is all an inbox row shows.
 */
export function withLastMessage(data, message) {
  if (!message || !data || !Array.isArray(data.items)) return data;

  const conversationId = message.conversation;
  const existing = data.items.find((item) => item._id === conversationId);
  if (!existing) return data;

  const updated = { ...existing, lastMessage: message, updatedAt: message.createdAt };
  return { ...data, items: [updated, ...data.items.filter((item) => item._id !== conversationId)] };
}

/** Splits a thread into the newest day first for a date separator. */
export function dayKey(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** The other participant's handle, for a label: "Conversation with @arjun". */
export function conversationLabel(conversation) {
  const other = conversation && conversation.other;
  if (!other) return "Conversation";
  return `Conversation with @${other.username}`;
}
