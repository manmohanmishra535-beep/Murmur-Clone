import Link from "next/link";
import Avatar from "./Avatar";
import Button from "./Button";
import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";
import { MailIcon } from "./icons";
import { errorMessage } from "@/services/api";
import { relativeTime } from "@/lib/format";

function ConversationRow({ conversation }) {
  const other = conversation.other || {};
  const last = conversation.lastMessage;

  return (
    <li>
      <Link
        href={`/messages/${conversation._id}`}
        className="flex items-start gap-3 border-b border-line bg-surface p-4 transition-colors duration-fast ease-out hover:bg-surface-2"
      >
        <Avatar
          size={44}
          src={other.profileImage}
          name={other.displayName}
          username={other.username}
        />

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold text-ink">
              {other.displayName || other.username}
            </span>
            {last ? (
              <time
                dateTime={last.createdAt}
                suppressHydrationWarning
                className="shrink-0 text-xs text-ink-3"
              >
                {relativeTime(last.createdAt)}
              </time>
            ) : null}
          </span>
          <span className="block truncate text-xs text-ink-3">@{other.username}</span>
          <span className="mt-0.5 block truncate text-sm text-ink-2">
            {last ? `${last.sender && last.sender._id === other._id ? "" : "You: "}${last.text}` : "No messages yet"}
          </span>
        </span>
      </Link>
    </li>
  );
}

function RowSkeleton() {
  return (
    <div className="flex gap-3 border-b border-line bg-surface p-4">
      <Skeleton className="h-11 w-11 rounded-pill" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

/** The inbox. The API orders it by last activity, and a push keeps it that way. */
export default function ConversationList({ query }) {
  const conversations = (query.data && query.data.items) || [];

  if (query.isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading conversations">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (query.isError) {
    const offline = query.error && !query.error.response;

    return (
      <EmptyState
        icon={MailIcon}
        title="Could not load your messages"
        action={
          <Button
            variant="secondary"
            loading={query.isFetching}
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        }
      >
        {errorMessage(query.error, "The API did not answer. Try again in a moment.")}
        {offline ? " The free API may be waking up; retry in a moment." : null}
      </EmptyState>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState icon={MailIcon} title="No conversations yet">
        Open someone&apos;s profile and choose Message to start one. Direct
        messages are private between the two of you.
      </EmptyState>
    );
  }

  return (
    <ul aria-label="Conversations">
      {conversations.map((conversation) => (
        <ConversationRow key={conversation._id} conversation={conversation} />
      ))}
    </ul>
  );
}
