"use strict";

const { Server } = require("socket.io");
const mongoose = require("mongoose");
const config = require("../config/env");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const { verifyToken, isCurrentToken, COOKIE_NAME } = require("../utils/token");
const { setIO, room, emitToUser } = require("./emitter");
const { createMessage } = require("../services/conversationService");

/**
 * Socket.IO has no cookie-parser, so the handshake's Cookie header is read by
 * hand. It is the same httpOnly token the REST API uses, which is why a socket
 * needs no separate credential.
 */
function tokenFromHandshake(socket) {
  const header = socket.handshake.headers.cookie || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Runs on the same HTTP server as Express. A connection is accepted only when
 * the handshake carries a valid JWT cookie, and each socket joins a private
 * room named after its user id, so a push to one person is io.to(userId).
 *
 * REST stays the one code path that writes data; the socket carries live pushes
 * and the one client-to-server write (message:send), which it hands to the same
 * service the REST route uses.
 */
function attach(server) {
  const io = new Server(server, {
    cors: { origin: config.clientUrl, credentials: true },
  });

  io.use(async (socket, next) => {
    if (!socket.handshake.headers.cookie) return next(new Error("UNAUTHENTICATED"));

    let payload;
    try {
      payload = verifyToken(tokenFromHandshake(socket));
    } catch {
      return next(new Error("UNAUTHENTICATED"));
    }

    // The handshake costs one extra read so a socket opened before a password
    // reset dies with the REST session instead of outliving it.
    try {
      const user = await User.findById(payload.id).select("tokenVersion");
      if (!user || !isCurrentToken(payload, user)) {
        return next(new Error("UNAUTHENTICATED"));
      }
      socket.data.userId = String(user._id);
      return next();
    } catch {
      return next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(room(userId));

    // The one write the socket performs. It goes through the service, so a
    // message sent over the socket is stored exactly like one sent over REST.
    socket.on("message:send", async (payload = {}, ack) => {
      try {
        const message = await createMessage(userId, payload.conversationId, payload.text);
        if (typeof ack === "function") ack({ ok: true, message });
      } catch (error) {
        if (typeof ack === "function") {
          ack({
            ok: false,
            error: {
              code: error.code || "INTERNAL_ERROR",
              message: error.message,
              fields: error.fields,
            },
          });
        }
      }
    });

    /**
     * Typing is presence, not data: it is forwarded to the other member of the
     * conversation and never stored. The payload is the documented one, so the
     * peer is resolved from the conversation rather than trusted from the client.
     */
    const relayTyping = async (event, payload = {}) => {
      const conversationId = payload && payload.conversationId;
      if (!conversationId || !mongoose.isValidObjectId(conversationId)) return;

      const conversation = await Conversation.findById(conversationId).select("participants");
      if (!conversation) return;
      if (!conversation.participants.some((id) => String(id) === userId)) return;

      for (const participant of conversation.participants) {
        if (String(participant) === userId) continue;
        emitToUser(participant, event, { conversationId: String(conversationId), userId });
      }
    };

    socket.on("typing:start", (payload) => relayTyping("typing:start", payload));
    socket.on("typing:stop", (payload) => relayTyping("typing:stop", payload));

    socket.on("error", (error) => {
      console.error("[socket] error:", error.message);
    });
  });

  setIO(io);
  return io;
}

module.exports = { attach, tokenFromHandshake };
