"use strict";

/**
 * The one place that holds the Socket.IO instance.
 *
 * It lives in its own module so feature code (notifications, the message
 * service) can push to a user without importing the socket server, which in
 * turn imports them for the client-to-server events. Dependencies point one
 * way, so there is no require cycle to reason about.
 */
let io = null;

function setIO(instance) {
  io = instance;
}

function getIO() {
  return io;
}

/** Each socket joins a private room named after its user id. */
function room(userId) {
  return String(userId);
}

/**
 * Push to one person's room. A no-op when the realtime layer is not attached
 * (tests, scripts), so a push can never break the request that caused it.
 */
function emitToUser(userId, event, payload) {
  if (!io || !userId) return false;
  io.to(room(userId)).emit(event, payload);
  return true;
}

module.exports = { setIO, getIO, room, emitToUser };
