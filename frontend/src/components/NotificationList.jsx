import Link from "next/link";
import clsx from "clsx";
import Avatar from "./Avatar";
import EmptyState from "./EmptyState";
import Skeleton from "./Skeleton";
import {
  BellIcon,
  HeartIcon,
  MailIcon,
  ReplyIcon,
  RepostIcon,
  UserIcon,
} from "./icons";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { errorMessage } from "@/services/api";
import { flattenNotifications, notificationHref, notificationPhrase } from "@/lib/notifications";
import { relativeTime } from "@/lib/format";

/** The glyph that says what happened, with the one semantic colour for a like. */
const KIND_ICON = {
  like: HeartIcon,
  comment: ReplyIcon,
  repost: RepostIcon,
  follow: UserIcon,
  message: MailIcon,
};

function NotificationRow({ notification }) {
  const Icon = KIND_ICON[notification.type] || BellIcon;
  const actor = notification.actor || {};
  const post = notification.post;
  const unread = !notification.read;

  return (
    <li>
      <Link
        href={notificationHref(notification)}
        className={clsx(
          "flex items-start gap-3 border-b border-line p-4 transition-colors duration-fast ease-out",
          unread ? "bg-accent-soft" : "bg-surface hover:bg-surface-2"
        )}
      >
        <span className="relative shrink-0">
          <Avatar
            size={40}
            src={actor.profileImage}
            name={actor.displayName}
            username={actor.username}
          />
          <span
            aria-hidden="true"
            className={clsx(
              "absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-pill border-2 border-surface bg-surface",
              notification.type === "like" ? "text-like" : "text-accent"
            )}
          >
            <Icon size={12} filled={notification.type === "like"} />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug text-ink">
            <span className="font-semibold">
              {actor.displayName || actor.username || "Someone"}
            </span>{" "}
            {notificationPhrase(notification.type)}
          </span>

          {post && post.content ? (
            <span className="mt-0.5 block truncate text-sm text-ink-3">{post.content}</span>
          ) : null}

          <time
            dateTime={notification.createdAt}
            suppressHydrationWarning
            className="mt-1 block text-xs text-ink-3"
          >
            {relativeTime(notification.createdAt)}
          </time>
        </span>

        {unread ? (
          <>
            <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-pill bg-accent" />
            <span className="sr-only">Unread</span>
          </>
        ) : null}
      </Link>
    </li>
  );
}

function RowSkeleton() {
  return (
    <div className="flex gap-3 border-b border-line bg-surface p-4">
      <Skeleton className="h-10 w-10 rounded-pill" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}

/** The notifications list, with the sentinel that loads the next page. */
export default function NotificationList({ query, label = "Notifications" }) {
  const items = flattenNotifications(query.data);

  const sentinelRef = useInfiniteScroll({
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  });

  if (query.isLoading) {
    return (
      <div aria-busy="true" aria-label={`Loading ${label.toLowerCase()}`}>
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (query.isError && items.length === 0) {
    return (
      <EmptyState icon={BellIcon} title="Could not load your notifications">
        {errorMessage(query.error, "The API did not answer. Try again in a moment.")}
      </EmptyState>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={BellIcon} title="Nothing yet">
        When someone likes, replies to or reposts your posts, or follows you, it
        shows up here.
      </EmptyState>
    );
  }

  return (
    <div>
      <ul aria-label={label}>
        {items.map((notification) => (
          <NotificationRow key={notification._id} notification={notification} />
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {query.isFetchingNextPage ? (
        <div className="flex justify-center p-4" aria-live="polite">
          <span className="h-5 w-5 animate-spin-fast rounded-pill border-2 border-ink-3 border-r-transparent" />
          <span className="sr-only">Loading more notifications</span>
        </div>
      ) : null}

      {!query.hasNextPage ? (
        <p className="p-4 text-center text-sm text-ink-3">That is everything for now.</p>
      ) : null}
    </div>
  );
}
