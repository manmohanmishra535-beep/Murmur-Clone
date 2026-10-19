"use strict";

const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const { serializeNotification, paginated } = require("../utils/serialize");
const { populateNotification } = require("../utils/notify");
const { parseLimit, paginate, cursorFilter } = require("../utils/pagination");

/** GET /api/notifications - the recipient's own rows, newest first. */
const listNotifications = asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit);

  const docs = await populateNotification(
    Notification.find({ recipient: req.user._id, ...cursorFilter(req.query.cursor) })
      .sort({ _id: -1 })
      .limit(limit + 1)
  );

  const { items, nextCursor } = paginate(docs, limit);
  res
    .status(200)
    .json(paginated(items, nextCursor, (doc) => serializeNotification(doc, { viewer: req.user })));
});

/** GET /api/notifications/unread-count - what the sidebar badge shows. */
const unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user._id, read: false });
  res.status(200).json({ count });
});

/**
 * PATCH /api/notifications/read - marks everything read, which is what opening
 * the notifications screen does. Also pushed to the user's other tabs, so the
 * badge clears everywhere they are signed in.
 */
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { $set: { read: true } }
  );

  res.status(204).end();
});

module.exports = { listNotifications, unreadCount, markAllRead };
