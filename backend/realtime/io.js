"use strict";

const { Server } = require("socket.io");
const mongoose = require("mongoose");
const { verifyToken } = require("@clerk/backend");
const config = require("../config/env");
const Conversation = require("../models/Conversation");
const { setIO, room, emitToUser } = require("./emitter");
const { ensureUser } = require("../services/userProvisioning");
const { createMessage } = require("../services/conversationService");

/**
 * Socket.IO has no Express middleware, so the Clerk session token travels in
 * the connection's auth payload. It is the same token the REST client sends as
 * a bearer header; a socket needs no separate credential.
 */
function tokenFromHandshake(socket) {
  const offered = socket.handshake.auth && socket.handshake.auth.token;
  if (offered) return String(offered);

  // A bearer header is accepted too, which makes the socket easy to probe from
  // a terminal with the same token the API uses.
  const header = socket.handshake.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Runs on the same HTTP server as Express. A connection is accepted only when
 * the handshake carries a Clerk session token signed for this app, and each
 * socket joins a private room named after its app user id, so a push to one
 * person is io.to(userId).
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
    const token = tokenFromHandshake(socket);
    if (!token) return next(new Error("UNAUTHENTICATED"));

    let claims;
    try {
      claims = await verifyToken(token, {
        secretKey: config.clerk.secretKey,
        jwtKey: config.clerk.jwtKey,
        authorizedParties: config.clerk.authorizedParties,
      });
    } catch {
      return next(new Error("UNAUTHENTICATED"));
    }

    if (!claims || !claims.sub) return next(new Error("UNAUTHENTICATED"));

    try {
      // Provisioning is idempotent; a socket opened before the first REST call
      // still ends up attached to the right profile.
      const user = await ensureUser({ userId: claims.sub, sessionClaims: claims });
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
