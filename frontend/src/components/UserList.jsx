import Link from "next/link";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import Skeleton from "./Skeleton";
import EmptyState from "./EmptyState";
import { UsersIcon } from "./icons";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { flattenPages } from "@/lib/posts";
import { compactNumber } from "@/lib/format";

/** One roster row: 44px avatar, name, handle, a one-line bio and a button. */
export function UserRow({ user }) {
  return (
    <div className="flex items-start gap-3 border-b border-line bg-surface p-4 transition-colors duration-fast ease-out hover:bg-surface-2">
      <Link
        href={`/${user.username}`}
        aria-label={`${user.displayName} (@${user.username})'s profile`}
        className="shrink-0"
      >
        <Avatar size={44} src={user.profileImage} name={user.displayName} username={user.username} />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="min-w-0 text-base leading-snug">
          <Link href={`/${user.username}`} className="font-semibold text-ink hover:underline">
            {user.displayName}
          </Link>{" "}
          <span className="text-sm text-ink-3">@{user.username}</span>
        </p>

        {user.bio ? (
          <p className="mt-0.5 line-clamp-2 break-words text-sm text-ink-2">{user.bio}</p>
        ) : null}

        <p className="mt-1 text-xs text-ink-3 tabular">
          {compactNumber(user.followerCount)} followers · {compactNumber(user.followingCount)}{" "}
          following
        </p>
      </div>

      <FollowButton user={user} />
    </div>
  );
}

function UserSkeleton() {
  return (
    <div className="flex gap-3 border-b border-line bg-surface p-4">
      <Skeleton className="h-11 w-11 rounded-pill" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

/** Renders an infinite query of users with the same sentinel pattern as PostList. */
export default function UserList({ query, label = "People", empty = null, className }) {
  const users = flattenPages(query.data);

  const sentinelRef = useInfiniteScroll({
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  });

  if (query.isLoading) {
    return (
      <div className={className} aria-busy="true" aria-label={`Loading ${label.toLowerCase()}`}>
        <UserSkeleton />
        <UserSkeleton />
        <UserSkeleton />
      </div>
    );
  }

  if (query.isError && users.length === 0) {
    return (
      <div className={className}>
        <EmptyState icon={UsersIcon} title="Could not load this list">
          The API did not answer. Try again in a moment.
        </EmptyState>
      </div>
    );
  }

  if (users.length === 0) return <div className={className}>{empty}</div>;

  return (
    <div className={className}>
      <ul aria-label={label}>
        {users.map((user) => (
          <li key={user._id}>
            <UserRow user={user} />
          </li>
        ))}
      </ul>

      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {query.isFetchingNextPage ? (
        <div className="flex justify-center p-4" aria-live="polite">
          <span className="h-5 w-5 animate-spin-fast rounded-pill border-2 border-ink-3 border-r-transparent" />
          <span className="sr-only">Loading more people</span>
        </div>
      ) : null}
    </div>
  );
}
