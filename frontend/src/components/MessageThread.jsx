import { Fragment, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import Avatar from "./Avatar";
import Button from "./Button";
import Skeleton from "./Skeleton";
import { useSocket } from "@/hooks/useSocket";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { MESSAGE_MAX, dayKey, messagesInOrder } from "@/lib/messages";
import { relativeTime } from "@/lib/format";
import { errorMessage } from "@/services/api";

/** One bubble. Your own messages sit right-aligned; the peer's sit left. */
function Bubble({ message, mine }) {
  const sender = message.sender || {};

  return (
    <li className={clsx("flex gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine ? (
        <Avatar
          size={32}
          className="mt-auto"
          src={sender.profileImage}
          name={sender.displayName}
          username={sender.username}
        />
      ) : null}

      <div className="max-w-[78%]">
        <div
          className={clsx(
            "whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-relaxed",
            mine
              ? "bg-accent text-accent-ink"
              : "border border-line bg-surface-2 text-ink"
          )}
        >
          {message.text}
        </div>
        <time
          dateTime={message.createdAt}
          suppressHydrationWarning
          className={clsx("mt-1 block text-xs text-ink-3", mine ? "text-right" : "text-left")}
        >
          {relativeTime(message.createdAt)}
        </time>
      </div>
    </li>
  );
}

/** A quieter divider than a timestamp on every bubble. */
function DayDivider({ iso }) {
  const label = new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs text-ink-3">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </li>
  );
}

/**
 * The chat window: the thread in reading order, the composer, and the peer's
 * typing indicator. New messages arrive through the socket and are written into
 * the query cache by the provider, so this only reads it.
 */
export default function MessageThread({ conversation, viewerId, query, sending, onSend }) {
  const [value, setValue] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const { socket, setTyping } = useSocket();
  const typingTimer = useRef(null);
  const announcedTyping = useRef(false);
  const bottomRef = useRef(null);

  const conversationId = conversation ? conversation._id : null;
  const messages = messagesInOrder(query.data);

  // The peer's typing indicator. It clears on a timer as well as on the stop
  // event, because a closed tab never gets to send one.
  useEffect(() => {
    if (!socket || !conversationId) return undefined;

    function onStart(payload) {
      if (!payload || payload.conversationId !== conversationId) return;
      setPeerTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setPeerTyping(false), 4000);
    }

    function onStop(payload) {
      if (!payload || payload.conversationId !== conversationId) return;
      clearTimeout(typingTimer.current);
      setPeerTyping(false);
    }

    socket.on("typing:start", onStart);
    socket.on("typing:stop", onStop);
    return () => {
      socket.off("typing:start", onStart);
      socket.off("typing:stop", onStop);
      clearTimeout(typingTimer.current);
    };
  }, [socket, conversationId]);

  // Follow the newest message, the way a chat window does.
  useEffect(() => {
    if (bottomRef.current && messages.length > 0) {
      bottomRef.current.scrollIntoView({ block: "end" });
    }
  }, [messages.length]);

  const sentinelRef = useInfiniteScroll({
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  });

  function handleChange(event) {
    const next = event.target.value;
    setValue(next);

    // One start when the field becomes non-empty, one stop when it empties, on
    // top of the stop the send itself sends.
    const typing = next.trim().length > 0;
    if (typing !== announcedTyping.current) {
      announcedTyping.current = typing;
      setTyping(conversationId, typing);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const text = value.trim();
    if (!text || sending) return;

    setValue("");
    if (announcedTyping.current) {
      announcedTyping.current = false;
      setTyping(conversationId, false);
    }

    try {
      await onSend(text);
    } catch {
      // The hook already raised a toast; give the text back so it is not lost.
      setValue(text);
    }
  }

  const overLimit = value.trim().length > MESSAGE_MAX;
  const other = conversation && conversation.other ? conversation.other : {};

  return (
    <div className="flex min-h-[60dvh] flex-col">
      {query.isLoading ? (
        <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading messages">
          <Skeleton className="h-10 w-3/5 rounded-lg" />
          <Skeleton className="ml-auto h-10 w-2/5 rounded-lg" />
          <Skeleton className="h-10 w-1/2 rounded-lg" />
        </div>
      ) : query.isError ? (
        <p className="p-4 text-sm text-danger">
          {errorMessage(query.error, "Could not load this conversation.")}
        </p>
      ) : messages.length === 0 ? (
        <p className="p-6 text-center text-sm text-ink-3">
          No messages yet. Say hello to {other.displayName || `@${other.username}`}.
        </p>
      ) : (
        <ul aria-label={`Messages with @${other.username}`} className="flex flex-col gap-3 p-4">
          {/* Older pages load above the thread, so the sentinel sits first. */}
          <li ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

          {query.isFetchingNextPage ? (
            <li className="py-2 text-center text-xs text-ink-3">Loading older messages…</li>
          ) : null}

          {query.hasNextPage ? (
            <li className="pb-2 text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => query.fetchNextPage()}
              >
                Load earlier messages
              </Button>
            </li>
          ) : null}

          {messages.map((message, index) => {
            const previous = index > 0 ? messages[index - 1] : null;
            const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
            const senderId = message.sender ? message.sender._id : null;

            return (
              <Fragment key={message._id}>
                {newDay ? <DayDivider iso={message.createdAt} /> : null}
                <Bubble message={message} mine={String(senderId) === String(viewerId)} />
              </Fragment>
            );
          })}

          <li ref={bottomRef} aria-hidden="true" className="h-px w-full" />
        </ul>
      )}

      {peerTyping ? (
        <p aria-live="polite" className="px-4 pb-1 text-xs text-ink-3">
          @{other.username} is typing…
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 mt-auto flex items-end gap-2 border-t border-line bg-surface p-3"
        aria-label={`Message @${other.username}`}
      >
        <label className="sr-only" htmlFor="message-input">
          Message
        </label>
        <textarea
          id="message-input"
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter writes a new line.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          placeholder={`Message @${other.username}`}
          aria-invalid={overLimit || undefined}
          className="min-h-11 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <Button type="submit" size="sm" loading={sending} disabled={!value.trim() || overLimit}>
          Send
        </Button>
      </form>
    </div>
  );
}
