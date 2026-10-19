import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { patchCachedPost } from "@/hooks/usePostActions";
import {
  bumpUnread,
  notificationText,
  prependNotification,
  withoutNotification,
} from "@/lib/notifications";
import { appendMessage, withLastMessage } from "@/lib/messages";
import { withCounts } from "@/lib/posts";

export const SocketContext = createContext(null);

/** The API and the socket share a port, so this is the API's origin. */
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

/**
 * The unread badge is a plain number in the query cache, so a push can move it
 * without a refetch. An undefined value means the first fetch has not landed
 * yet; it is left alone, because the request already in flight carries the real
 * count and will write it there.
 */
function moveUnread(queryClient, delta) {
  if (!delta) return;
  queryClient.setQueryData(["notifications", "unread"], (previous) =>
    typeof previous === "number" ? bumpUnread(previous, delta) : previous
  );
}

/**
 * One socket for the whole app, opened once the session is known and closed on
 * logout. Every handler writes straight into the React Query cache, which is
 * what lets a like arrive as a live notification without a page refresh.
 *
 * REST stays the one code path that stores data; the socket carries the pushes,
 * and the one write it accepts (message:send) is handed to the same service the
 * REST route uses.
 */
export function SocketProvider({ children }) {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const hasConnected = useRef(false);

  const userId = user ? user._id : null;

  useEffect(() => {
    if (status !== "authenticated" || !userId) return undefined;

    // The handshake carries the same httpOnly token cookie the REST API uses,
    // because withCredentials sends cookies on the upgrade request.
    const instance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    instance.on("connect", () => {
      setConnected(true);
      // Anything pushed while the socket was down was missed, so the badge is
      // refetched on a reconnection. The first connect is skipped: the query has
      // just run and would only repeat itself.
      if (hasConnected.current) queryClient.invalidateQueries({ queryKey: ["notifications"] });
      hasConnected.current = true;
    });
    instance.on("disconnect", () => setConnected(false));
    instance.on("connect_error", () => setConnected(false));

    instance.on("notification:new", (notification) => {
      if (!notification || !notification._id) return;
      queryClient.setQueryData(["notifications"], (data) =>
        prependNotification(data, notification)
      );
      moveUnread(queryClient, notification.read ? 0 : 1);
      toast(notificationText(notification), { variant: "info" });
    });

    // Unliking and unfollowing take their row back. `read` says whether that row
    // was still counting toward the badge.
    instance.on("notification:remove", (payload) => {
      if (!payload || !payload._id) return;
      queryClient.setQueryData(["notifications"], (data) =>
        withoutNotification(data, payload._id)
      );
      moveUnread(queryClient, payload.read ? 0 : -1);
    });

    instance.on("message:new", (message) => {
      if (!message || !message._id) return;
      queryClient.setQueryData(["messages", message.conversation], (data) =>
        appendMessage(data, message)
      );
      queryClient.setQueryData(["conversations"], (data) => withLastMessage(data, message));
    });

    // Live counters on the viewer's own posts, wherever they are on screen.
    instance.on("post:counts", (counts) => {
      if (!counts || !counts.postId) return;
      patchCachedPost(queryClient, counts.postId, (post) => withCounts(post, counts));
    });

    setSocket(instance);

    return () => {
      hasConnected.current = false;
      setSocket(null);
      setConnected(false);
      instance.close();
    };
  }, [status, userId, queryClient, toast]);

  /** Typing is presence only: it is forwarded to the other participant. */
  const setTyping = useCallback(
    (conversationId, typing) => {
      if (!socket || !conversationId) return;
      socket.emit(typing ? "typing:start" : "typing:stop", { conversationId });
    },
    [socket]
  );

  const value = useMemo(
    () => ({ socket, connected, setTyping }),
    [socket, connected, setTyping]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
