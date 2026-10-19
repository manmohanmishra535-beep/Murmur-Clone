/**
 * Pure helpers for the notification list. They live outside the hooks so the
 * cache arithmetic can be tested without a browser or a live socket.
 */

/** The verb a row reads as, keyed by the type the API stores. */
const PHRASES = {
  like: "liked your post",
  comment: "replied to your post",
  repost: "reposted your post",
  follow: "followed you",
  message: "sent you a message",
};

/** "Arjun liked your post" - the one line a row shows. */
export function notificationText(notification) {
  if (!notification) return "";
  const actor = notification.actor || {};
  const who = actor.displayName || actor.username || "Someone";
  const phrase = PHRASES[notification.type] || "did something";
  return `${who} ${phrase}`;
}

/** Where a row points: the post, the chat, or the account behind the action. */
export function notificationHref(notification) {
  if (!notification) return "/notifications";
  if (notification.post && notification.post._id) return `/post/${notification.post._id}`;
  if (notification.type === "message" && notification.conversation) {
    return `/messages/${notification.conversation}`;
  }
  const actor = notification.actor || {};
  return actor.username ? `/${actor.username}` : "/notifications";
}

/** The row that a notification refers to, or undefined when it is not loaded. */
function findNotification(data, id) {
  if (!data || !Array.isArray(data.pages)) return undefined;
  for (const page of data.pages) {
    const found = (page.items || []).find((item) => item._id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Adds a pushed notification to the top of the first page. A push and a refetch
 * can both deliver the same row, so an id already in the list is left alone
 * rather than shown twice.
 */
export function prependNotification(data, notification) {
  if (!notification) return data;
  if (!data || !Array.isArray(data.pages)) return data;
  if (findNotification(data, notification._id)) return data;

  if (data.pages.length === 0) {
    return { ...data, pages: [{ items: [notification], nextCursor: null }] };
  }

  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [{ ...first, items: [notification, ...(first.items || [])] }, ...rest],
  };
}

/** Drops one notification from wherever it sits, which is what unliking does. */
export function withoutNotification(data, id) {
  if (!data || !Array.isArray(data.pages)) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: (page.items || []).filter((item) => item._id !== id),
    })),
  };
}

/** The row's unread state, so a removal knows whether the badge moves with it. */
export function isUnread(data, id) {
  const found = findNotification(data, id);
  return found ? !found.read : false;
}

/** The badge count moved by one, and never below zero. */
export function bumpUnread(previous, delta) {
  return Math.max(0, (Number(previous) || 0) + delta);
}

/** Every loaded row as one list, newest first. */
export function flattenNotifications(data) {
  if (!data || !Array.isArray(data.pages)) return [];
  return data.pages.flatMap((page) => (page && Array.isArray(page.items) ? page.items : []));
}
